# FlatGL Architecture

## Overview

FlatGL is a WebGL 2.0 game engine structured around an Entity-Component-System (ECS) core. There are no external runtime dependencies — every layer from math to GPU submission is implemented directly.

The main entry point is `Engine.create()`. It owns all GPU resources, wires the systems together, and drives a fixed `requestAnimationFrame` loop. Users interact with the engine through three facades: `engine.world` (ECS), `engine.assets` (GPU resource creation), and `engine.input` (input snapshot).

---

## Layer Map

```
Engine (engine/Engine.ts)
│
├── World (core/World.ts)          — ECS store and query cache
├── AssetFactory (engine/)         — creates Mesh, Material, Texture, ParticleEmitter, Skeleton, Animator
├── Camera (engine/)               — view/proj matrices, perspective or orthographic
├── InputManager (engine/)         — keyboard + mouse snapshot, mouseWorld unproject
│
├── Systems (systems/)             — update/render loop participants
│   ├── ScriptSystem               — runs ScriptBehavior lifecycle (onStart/onUpdate/onDestroy)
│   ├── AnimationSystem            — keyframe sampling, joint hierarchy forward pass, GPU skinning data upload
│   ├── ShadowSystem               — depth-only pass from light POV into shadowFb
│   ├── RenderSystem               — Blinn-Phong scene pass into sceneFb; material-batched draw calls
│   └── ParticleSystem             — simulate + GPU-instanced billboard render; owns per-emitter GpuState
│
├── SkyboxPass (engine/)           — equirectangular panorama via fullscreen triangle; renders into sceneFb after the scene pass, before particles
├── ScreenPass (engine/)           — fullscreen quad: distance fog, FXAA, contrast/saturation grade
│
└── Renderer (renderer/)           — thin WebGL2 wrappers: Shader, Buffer, Texture, Framebuffer, RenderContext
```

---

## ECS Core

### Entity

An `Entity` is a plain `number` (integer ID). IDs are handed out by `World.create()` and recycled via a `freed[]` stack when `World.destroy(entity)` is called. There are no generation counters — a stale `parent` reference in `Transform` will silently resolve to the new owner of a recycled ID.

### Component

`Component` is an abstract base class (`core/Component.ts`). Every component class extends it. The only protocol it enforces is an optional `destroy(): void` hook that `World` calls when the entity is destroyed.

Concrete components: `Transform`, `Mesh`, `SkinnedMesh`, `Material`, `Script`, `Skeleton`, `Animator`, `ParticleEmitter`, `DirectionalLight`.

### World

`World` is a sparse set implemented as a `Map<Ctor, Map<Entity, Component>>`. The outer key is the concrete constructor (not a string tag). `add()` stores under `component.constructor`, which means abstract base class queries always return empty — only the exact concrete type is used as a key.

Query results are cached by a key derived from sorted constructor IDs and invalidated by a monotonic `version` counter that increments on every `add`, `remove`, and `destroy`. The query key string is rebuilt on every call before the cache check, which is a minor hot-path cost.

### System dispatch

`Engine.start()` drives two phases per tick. The update phase loops over the systems in registration order (`ScriptSystem → AnimationSystem → ShadowSystem → RenderSystem → ParticleSystem`), calling `system.update(dt)`. The render phase is a fixed sequence of explicit calls, not a loop:

```
shadowSystem.render()
renderSystem.render()
skyboxPass?.render()      // only when a skybox is set
particleSystem.render()
screenPass.render()
```

The `InputManager` is updated before the systems.

---

## Render Pipeline

### Pass 1 — Shadow

`ShadowSystem` renders depth-only into a 2048×2048 `Framebuffer` (`shadowFb`) from the light's orthographic perspective. A static `lightSpaceMat` (view × proj from light POV) is computed once in `Engine` at construction and passed to `ShadowSystem` and `AssetFactory` (so materials can sample the shadow map). Frustum culling uses the light's clip planes. Skinned meshes use a `USE_SKINNING` shader variant compiled separately.

### Pass 2 — Scene

`RenderSystem` renders into a full-resolution `Framebuffer` (`sceneFb`) with Blinn-Phong shading and PCF soft shadows. It queries `Mesh + Material` and `SkinnedMesh + Material` separately and groups them into material batches to minimise shader switches. Frustum culling happens per-entity using the camera's six clip planes and each mesh's pre-computed bounding sphere. `getWorldMatrix` is called twice per entity per frame (cull pass + draw pass), which is a known performance issue.

### Pass 3 — Skybox

`SkyboxPass` is optional — created lazily via `engine.setSkybox(texture)`. It renders an equirectangular panorama texture onto a fullscreen triangle (no geometry — the vertex shader emits 3 hard-coded clip-space positions). The fragment shader reconstructs a world-space ray direction from `inverse(ViewProjection)` and maps it to equirectangular UVs. The view matrix has its translation column zeroed so the skybox stays at infinity. Depth is written as 1.0 and tested with `LEQUAL`, so only pixels not covered by scene geometry are filled; particles blend over it in the next pass. `depthMask` is disabled during the pass to avoid overwriting the depth buffer. Calling `setSkybox` again destroys the previous pass and creates a new one.

### Pass 4 — Particles

`ParticleSystem` renders after the skybox pass into the same `sceneFb`. It owns a `Map<ParticleEmitter, GpuState>` where `GpuState` holds the VAO, quad VBO, instance VBO, instance data buffer, and resolved texture. GPU state is lazily initialised on first render of each emitter and destroyed when the emitter is removed from the world. Simulation (physics, spawn) runs in `update()`; instance data upload and draw happen in `render()`.

### Pass 5 — Screen

`ScreenPass` blits `sceneFb`'s colour and depth attachments through a fullscreen-quad shader. When fog is enabled, the shader linearises the depth buffer and blends the scene colour toward a configurable fog colour based on linear distance (clamped between `fog.near` and `fog.far`). Fog is applied before the contrast/saturation grade so it integrates naturally. FXAA anti-aliasing and optional contrast/saturation grading follow. Output goes to the default framebuffer (the canvas).

---

## GPU Resource Ownership

Resources are created by `AssetFactory` and owned by the caller. `World.destroy(entity)` calls `component.destroy()` on every component attached to that entity, which frees GPU objects (VAO, index buffer, WebGL texture, etc.).

Previously documented gaps that have since been fixed (kept here so they aren't re-reported):

- `Mesh.destroy()` frees the VBO (`this.buffer.destroy()`) along with the VAO and IBO.
- `RenderSystem.destroy()` exists and frees the debug shader and debug mesh allocated by `showBoundingSpheres`.
- `Texture.configure()` resets `UNPACK_FLIP_Y_WEBGL` to `false` after every upload, so `Texture.load()` no longer leaks the flag globally.

---

## Transform Hierarchy

`Transform.parent` stores an `Entity` reference. `getWorldMatrix(entity, world)` recurses up the parent chain to compose the world matrix. There is no cycle detection — a cycle causes a stack overflow. World matrices are recomputed from scratch on every call with no caching between the cull and draw phases.

---

## Skeletal Animation

`GltfLoader` parses GLB files into `GltfDocument`, which `AssetFactory.createGltf()` turns into a `Skeleton` + `Animator` + `SkinnedMesh` triple. The `Skeleton` holds flat Float32Arrays for joint local TRS state and a `jointMatrices` Float32Array that is the final GPU-ready palette (inverse-bind × world). `AnimationSystem` samples keyframes each frame, runs a parent-before-child forward pass to accumulate world matrices, and writes the final palette. The system assumes joints are topologically sorted (parent index < child index), which is not guaranteed by the glTF spec.

---

## Math Library

All math types (`Vec3`, `Mat4`, `Quat`) are immutable — every operation returns a new object. This is ergonomic but creates GC pressure in hot loops. There are no in-place or scratch-buffer variants. Key allocating operations in the hot path: `Transform.matrix()` (5 Mat4s), `Mat4.fromTRS` (1 Mat4), `Mat4.multiply` (1 Mat4), `Vec3` constructors throughout.

---

## Shader System

Shaders are plain GLSL 3.00 ES strings imported as modules (via a custom esbuild loader). `Shader.fromSource()` compiles, links, and wraps them. The `USE_SKINNING` preprocessor define is toggled by passing `['USE_SKINNING']` to `fromSource`. Uniform locations are looked up by name via `gl.getUniformLocation`; there is no automatic caching — callers are responsible for caching locations if they matter for performance.
