# FlatGL Fix Plan

Findings from the full codebase audit. Ordered by severity. Check items off as they are resolved.

---

## Critical — Fix immediately

### 1. VBO leak in `Mesh`

**File:** `src/components/Mesh.ts`

`Mesh.destroy()` frees the VAO and IBO but not the vertex buffer. The `Buffer` passed to the constructor is used to configure attribs and then dropped — its underlying `WebGLBuffer` is never deleted. Every mesh that is ever destroyed (or that the engine is shut down with) leaks one `WebGLBuffer`. `SkinnedMesh` passes a second `skinBuffer` that is also orphaned.

Fix: store the buffer reference(s) in the constructor and call `buffer.destroy()` inside `destroy()`.

---

### 2. `UNPACK_FLIP_Y_WEBGL` set globally, never reset

**File:** `src/renderer/Texture.ts` line 113

`Texture.load()` calls `gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)` inside the `img.onload` callback and never resets it to `false`. Every `texImage2D` call after the first `Texture.load()` — including depth textures and render targets — will have its rows inverted.

Fix: call `gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)` immediately after the `texImage2D` call.

---

### 3. `GltfLoader` — empty accessor produces `NaN` clip duration

**File:** `src/loaders/GltfLoader.ts` line 198

```ts
duration = Math.max(duration, times[times.length - 1]);
```

If a sampler's input accessor has `count = 0`, `times[-1]` is `undefined`, and `Math.max(n, undefined)` is `NaN`. The `AnimationSystem` guard `clip.duration <= 0` does not catch `NaN`, so the skeleton's local arrays are filled with `NaN` and the mesh renders as degenerate geometry.

Fix: guard before the `Math.max` call — `if (times.length > 0) duration = Math.max(duration, times[times.length - 1]);`

---

### 4. `AnimationSystem` — assumes topologically sorted joints

**File:** `src/systems/AnimationSystem.ts` lines 124–141

The forward pass reads `worldMats[parentIndices[j]]` before it has necessarily been written. The comment says joints must be in topological order (parent index < child index). The glTF 2.0 spec does not guarantee this. A glTF from an exporter that uses a different joint ordering causes a `TypeError: Cannot read properties of undefined` crash on every frame.

Fix: either topologically sort joints in `GltfLoader` when building the `Skeleton`, or add an explicit sort in `AnimationSystem` before the forward pass.

---

### 5. Cyclic `Transform.parent` causes stack overflow

**File:** `src/components/Transform.ts` lines 27–33

`getWorldMatrix` recurses on `Transform.parent` with no visited-set or depth limit. Any cycle (`t.parent = entity` self-reference, or a two-node A→B→A cycle) throws `RangeError: Maximum call stack size exceeded` on every render frame.

Fix: add a depth counter or a small visited set (max hierarchy depth is typically < 16) and throw a descriptive error on cycle detection rather than crashing the stack.

---

## High — Fix soon

### 6. `RenderSystem` has no `destroy()` method

**File:** `src/systems/RenderSystem.ts`

`debugShader` (WebGLProgram) and `debugMesh` (VAO + VBO) are allocated by `initDebug()` when `showBoundingSpheres` is first enabled. `RenderSystem` does not implement `destroy()`, so `Engine.destroy()` silently skips them. They leak on every engine shutdown when bounding sphere debug has been enabled.

Fix: add `destroy(): void` that calls `this.debugShader?.destroy()` and `this.debugMesh?.destroy()`.

---

### 7. `Engine.destroy()` calls `world.destroyAll()` twice

**File:** `src/engine/Engine.ts` lines 272–274

`scriptSystem.destroyAll()` (line 272) calls `world.destroyAll()` internally, resetting `nextId = 0`. Line 274 calls `world.destroyAll()` a second time. Any `System.destroy()` that queries or mutates the world (in the loop on line 273) operates on an already-reset world.

Fix: remove the redundant `this.world.destroyAll()` call on line 274 — `scriptSystem.destroyAll()` already handles it.

---

### 8. `ShadowSystem` uses wrong bounding sphere center for frustum culling

**File:** `src/systems/ShadowSystem.ts` lines 54–62

Shadow culling uses `worldMat.array[12/13/14]` (the entity pivot in world space) as the sphere center. Meshes whose geometry origin does not coincide with the entity pivot are culled incorrectly. `RenderSystem` correctly transforms `mesh.boundingSphere.center` through the world matrix.

Fix: apply the same transform as `RenderSystem.ts` lines 169–172:

```ts
const c = mesh.boundingSphere.center;
const cx =
  worldMat.array[0] * c.x +
  worldMat.array[4] * c.y +
  worldMat.array[8] * c.z +
  worldMat.array[12];
const cy =
  worldMat.array[1] * c.x +
  worldMat.array[5] * c.y +
  worldMat.array[9] * c.z +
  worldMat.array[13];
const cz =
  worldMat.array[2] * c.x +
  worldMat.array[6] * c.y +
  worldMat.array[10] * c.z +
  worldMat.array[14];
```

---

### 9. `getWorldMatrix` called twice per entity per frame in `RenderSystem`

**File:** `src/systems/RenderSystem.ts` lines 164–165, 209

`getWorldMatrix` is called once in the frustum cull loop and again in the draw loop. Each call recursively allocates `Mat4` objects up the parent chain. The cull result is discarded; the draw pass recomputes from scratch.

Fix: compute all world matrices once into a `Map<Entity, Mat4>` during the cull pass, then look them up in the draw pass.

---

### 10. `ScriptSystem.started` — shared behavior instance suppresses `onStart` on second entity

**File:** `src/systems/ScriptSystem.ts` lines 15–17

`started` is a `Set<ScriptBehavior>` keyed by object reference. If the same behavior instance is added to `Script` components on two different entities, the second entity never receives `onStart`. This is an uncommon pattern but silent and surprising.

Fix: key `started` by `(entity, behavior)` pairs (e.g. a `Set<string>` with `"${entity}:${behaviorIndex}"` keys, or a `Map<Entity, Set<ScriptBehavior>>`).

---

## Performance

### 11. `ParticleSystem` fetches uniform locations every render frame

**File:** `src/systems/ParticleSystem.ts` lines 148–150

`shader.uniformLocation('u_view')`, `'u_projection'`, `'u_texture'` are called every `render()` via `gl.getUniformLocation`, a synchronous GPU driver round-trip. These locations are static after shader compilation.

Fix: cache the three `WebGLUniformLocation` values in the constructor.

---

### 12. `AnimationSystem` — 6–7 allocations per joint per frame

**File:** `src/systems/AnimationSystem.ts` lines 127–144

Per joint, per frame: `new Vec3` × 2, `Quat.fromArray` (new Quat), `Mat4.fromTRS` (new Float32Array + Mat4), two `Mat4.multiply` calls (two more Float32Array + Mat4). A 30-joint skeleton at 60 fps generates ~12,000 short-lived objects/second from this loop, causing measurable GC pauses.

Fix: add in-place variants (`Mat4.multiplyInto`, `Mat4.fromTRSInto`) that write into pre-allocated scratch buffers stored on the system.

---

### 13. `World.query()` builds the cache key before checking the cache

**File:** `src/core/World.ts` lines 73–76

`types.map(…).sort(…).join(',')` allocates a temporary array and sorts it on every `query()` call, including cache hits. With ~10 query calls per frame this is unnecessary allocation even when the cache is warm.

Fix: build the key inside the cache-miss branch only, or use a `WeakMap`-based key that avoids string construction entirely.

---

### 14. `RenderSystem` / `ShadowSystem` — spread-concat allocates new entity array every frame

**Files:** `src/systems/RenderSystem.ts` lines 155–156, `src/systems/ShadowSystem.ts` lines 45–47

`[...this.world.query(Mesh, Material), ...world.query(SkinnedMesh, Material)]` discards the cached query result arrays and allocates a new merged array each frame.

Fix: iterate each query result directly in sequence without concatenating.

---

### 15. Inverse bind matrices re-wrapped per joint per frame

**File:** `src/systems/AnimationSystem.ts` line 144

`Mat4.fromArray(skeleton.inverseBindMatrices, j * 16)` copies static data into a new `Mat4` every joint every frame. These matrices are constant after skeleton construction.

Fix: add `Skeleton.inverseBindMat4s: Mat4[]` pre-computed in the constructor, reuse in `AnimationSystem`.

---

### 16. `inFrustum` receives a `new Vec3` per entity per cull pass

**File:** `src/systems/RenderSystem.ts` line 177

`new Vec3(cx, cy, cz)` is allocated as a wrapper just to pass three scalars into `inFrustum`. `inFrustum` only uses `.x/.y/.z`.

Fix: add an `inFrustumXYZ(planes, cx, cy, cz, radius)` signature that takes scalars directly.

---

## Low / Informational

### 17. Stats overlay `<div>` not removed by `Engine.destroy()`

**File:** `src/engine/Engine.ts`

`destroy()` does not call `this.statsEl?.remove()`. In a SPA that re-mounts the canvas and re-creates the engine, the old stats overlay accumulates in the DOM.

Fix: add `this.statsEl?.remove(); this.statsEl = null;` to `destroy()`.

---

### 18. `world.destroy()` bypass leaves stale `ScriptSystem.started` entries

**File:** `src/systems/ScriptSystem.ts`

Calling `world.destroy(entity)` directly (instead of `engine.destroyEntity(entity)`) skips `ScriptSystem.destroyEntity()`, leaving behavior instances in `started` forever. If those same instances are later re-added to a new entity, `onStart` is silently skipped.

This is partially a documentation issue — the README already says to use `engine.destroyEntity()`. But it is easy to call `world.destroy()` directly and get silent misbehaviour.

---

### 19. Entity ID recycling — stale `Transform.parent` silently resolves to wrong entity

**File:** `src/core/World.ts`, `src/components/Transform.ts`

`World` recycles integer entity IDs with no generation counter. After destroying a parent entity, its ID may be reused. Any child `Transform` that still names the old ID will compute its world matrix relative to the new entity's transform without any error.

A full fix requires adding generation tags. A simpler mitigation is to document that parent references must be cleared before destroying the parent.
