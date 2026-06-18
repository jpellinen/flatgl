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
├── ScreenPass (engine/)           — fullscreen FXAA + color grade quad
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

`Engine.start()` drives two passes per tick:

```
for each system: system.update(dt)
for each system: system.render()
```

Systems are run in registration order: `ScriptSystem → AnimationSystem → ShadowSystem → RenderSystem → ParticleSystem`. The `InputManager` is updated before systems. The `ScreenPass` runs after all system renders.

---

## Render Pipeline

### Pass 1 — Shadow

`ShadowSystem` renders depth-only into a 2048×2048 `Framebuffer` (`shadowFb`) from the light's orthographic perspective. A static `lightSpaceMat` (view × proj from light POV) is computed once in `Engine` at construction and passed to `ShadowSystem` and `AssetFactory` (so materials can sample the shadow map). Frustum culling uses the light's clip planes. Skinned meshes use a `USE_SKINNING` shader variant compiled separately.

### Pass 2 — Scene

`RenderSystem` renders into a full-resolution `Framebuffer` (`sceneFb`) with Blinn-Phong shading and PCF soft shadows. It queries `Mesh + Material` and `SkinnedMesh + Material` separately and groups them into material batches to minimise shader switches. Frustum culling happens per-entity using the camera's six clip planes and each mesh's pre-computed bounding sphere. `getWorldMatrix` is called twice per entity per frame (cull pass + draw pass), which is a known performance issue.

### Pass 3 — Particles

`ParticleSystem` renders after the scene pass into the same `sceneFb`. It owns a `Map<ParticleEmitter, GpuState>` where `GpuState` holds the VAO, quad VBO, instance VBO, instance data buffer, and resolved texture. GPU state is lazily initialised on first render of each emitter and destroyed when the emitter is removed from the world. Simulation (physics, spawn) runs in `update()`; instance data upload and draw happen in `render()`.

### Pass 4 — Screen

`ScreenPass` blits `sceneFb`'s colour attachment through a fullscreen-quad shader that applies FXAA anti-aliasing and optional contrast/saturation grading. Output goes to the default framebuffer (the canvas).

---

## GPU Resource Ownership

Resources are created by `AssetFactory` and owned by the caller. `World.destroy(entity)` calls `component.destroy()` on every component attached to that entity, which frees GPU objects (VAO, index buffer, WebGL texture, etc.).

Important gaps as of last audit:

- `Mesh.destroy()` frees the VAO and IBO but **not** the VBO — the `Buffer` passed to the constructor is not stored, so its `WebGLBuffer` leaks.
- `RenderSystem` has no `destroy()` method — the debug shader and debug mesh (allocated by `showBoundingSpheres`) are never freed.
- `Texture.load()` sets `UNPACK_FLIP_Y_WEBGL = true` globally and never resets it.

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

---

## Known Issues (as of last audit)

See [PLAN.md](../PLAN.md) for the full prioritised fix list. The headline items:

1. VBO leak in `Mesh` — the vertex `Buffer` is never freed
2. `UNPACK_FLIP_Y_WEBGL` set globally and never reset — corrupts all subsequent texture uploads
3. `NaN` duration from zero-length glTF animation accessors crashes the skeleton silently
4. `AnimationSystem` assumes topologically sorted joints — wrong ordering from some exporters causes a `TypeError` crash
5. Cyclic `Transform.parent` chain causes a stack overflow on every frame
6. `getWorldMatrix` called twice per entity per frame in `RenderSystem`
7. `ParticleSystem` fetches uniform locations every frame (should be cached at init)
8. `World.query()` builds the cache key string before checking the cache
