# FlatGL

An opinionated WebGL 2.0 engine for top-down games and game-like apps. Zero runtime dependencies — just TypeScript and direct WebGL2 API calls.

![WebGL2](https://img.shields.io/badge/WebGL-2.0-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue)

## Features

- **ECS architecture** — entities, components, and type-safe queries via `World`
- **Single entry point** — `Engine.create()` wires the full 3-pass pipeline internally
- **Shadow mapping** — one directional light with PCF soft shadows
- **FXAA post-processing** — anti-aliasing + optional contrast/saturation grade
- **Frustum culling** — camera and light frustums, bounding spheres auto-computed from mesh geometry
- **Top-down camera** — perspective (default) or orthographic, follows `camera.target`
- **Keyboard + mouse input** — `engine.input` with `mouseWorld` unprojected to the Y=0 ground plane
- **Script behaviours** — `onStart` / `onUpdate` / `onDestroy` lifecycle per entity
- **OBJ loader** — positions, normals, and UVs with flat-normal fallback

## Quickstart

```typescript
import { Engine, Script, Transform, Vec3, ObjLoader } from 'flatgl';
import type { ScriptBehaviour, Entity, World } from 'flatgl';

const engine = Engine.create({
  canvas: document.getElementById('glcanvas') as HTMLCanvasElement,
  camera: { height: 10, pitch: Math.PI / 3 },
  light:  { direction: new Vec3(1, 2, 1) },
  postProcess: { fxaa: true },
});

const { world, input } = engine;

const mesh = engine.createMesh(ObjLoader.parse(objSource));
const mat  = engine.createMaterial({ color: new Vec3(0.9, 0.8, 0.6) });

class PlayerMove implements ScriptBehaviour {
  onUpdate(entity: Entity, w: World, dt: number): void {
    const t = w.get(entity, Transform)!;
    const dx = (input.isDown('d') ? 1 : 0) - (input.isDown('a') ? 1 : 0);
    const dz = (input.isDown('s') ? 1 : 0) - (input.isDown('w') ? 1 : 0);
    const move = new Vec3(dx, 0, dz);
    if (move.length() > 0) {
      const dir = move.normalize();
      t.position = t.position.add(dir.scale(5 * dt));
      t.rotation = new Vec3(0, Math.atan2(dir.x, dir.z), 0);
    }
    engine.camera.target = t.position;
  }
}

const player = world.create();
world.add(player, mesh);
world.add(player, mat);
world.add(player, new Transform());
world.add(player, new Script(new PlayerMove()));

const stop = engine.start();
window.addEventListener('beforeunload', () => { stop(); engine.destroy(); });
```

## Public API

### `Engine`

```typescript
Engine.create(options: EngineOptions): Engine

engine.world: World               // ECS container
engine.camera: TopDownCamera      // set camera.target to pan
engine.input: InputSnapshot       // keyboard + mouse state (read each frame)

engine.start(): () => void        // starts RAF loop, returns stop function
engine.createMesh(data: ObjData): Mesh
engine.createMaterial(opts?: MaterialOptions): Material
engine.createTexture(data: Uint8Array, w: number, h: number): Texture
engine.loadTexture(url: string): Promise<Texture>
engine.destroyEntity(entity: Entity): void  // fires onDestroy, then removes
engine.destroy(): void
```

### `EngineOptions`

```typescript
{
  canvas: HTMLCanvasElement;
  camera?: {
    height?: number;         // default 10
    pitch?: number;          // radians from horizontal; default π/3 (~60°)
    fov?: number;            // default π/4; ignored when orthographic
    orthographic?: boolean;  // default false
    orthoSize?: number;      // half-height world units; default 8
    target?: Vec3;           // initial look-at point; default (0,0,0)
  };
  light?: {
    direction?: Vec3;        // default (1,2,1).normalize()
    color?: Vec3;            // default (1,1,1)
    intensity?: number;      // default 0.8
    ambient?: number;        // default 0.25
  };
  postProcess?: {
    fxaa?: boolean;          // default true
    contrast?: number;       // default 1.0
    saturation?: number;     // default 1.0
  };
}
```

### `MaterialOptions`

```typescript
{
  color?: Vec3;              // base color tint; default (1,1,1)
  texture?: Texture;         // diffuse texture; default solid white
  specular?: number;         // specular strength 0–1; default 0.3
  receiveShadows?: boolean;  // default true
}
```

### `InputSnapshot`

```typescript
input.isDown(key: string): boolean   // KeyboardEvent.key, e.g. 'w', 'ArrowUp'
input.keys: ReadonlySet<string>
input.mousePixel: { x, y }           // canvas pixel coordinates
input.mouseWorld: Vec3               // unprojected to Y=0 ground plane
input.mouseDown: boolean             // pressed this frame
input.mouseHeld: boolean
input.mouseUp: boolean               // released this frame
```

### `ScriptBehaviour`

```typescript
interface ScriptBehaviour {
  onStart?(entity: Entity, world: World): void;
  onUpdate(entity: Entity, world: World, dt: number): void;
  onDestroy?(entity: Entity, world: World): void;
}
```

Use `engine.destroyEntity(entity)` instead of `world.destroy()` to ensure `onDestroy` fires.

## Usage as a Library

Build with:

```bash
npm install
npm run build
```

This produces `dist/index.js` (ESM) and `dist/index.d.ts`. Consume via a local path reference:

```json
"dependencies": {
  "flatgl": "file:../flatgl"
}
```

## Demo

```bash
npm run dev:demo
```

Open `http://localhost:8080`. WASD to move the player, camera follows.

## Scripts

| Command | Description |
|---|---|
| `npm run build` | Build the library (`dist/index.js` + `dist/index.d.ts`) |
| `npm run dev` | Build the library in watch mode |
| `npm run build:demo` | One-time build of the demo |
| `npm run dev:demo` | Build demo in watch mode, serve on port 8080 |
| `npm run lint` | Run ESLint on `src/` |

## Project Structure

```
src/
├── index.ts              # Public API (14 exports)
├── engine/               # Engine, TopDownCamera, InputSystem
├── core/                 # ECS primitives (World, Entity)
├── components/           # Mesh, Material, Transform, Script
├── systems/              # RenderSystem, ShadowSystem, ScriptSystem
├── renderer/             # WebGL2 wrappers (Shader, Buffer, Texture, Framebuffer)
├── math/                 # Vec3, Mat4
├── loaders/              # OBJ parser
├── shaders/              # GLSL 3.00 ES (scene, shadow, screen/FXAA)
└── assets/               # .obj model files
examples/
└── demo.ts               # Top-down player movement demo (~80 lines)
```

## Rendering Pipeline

1. **Shadow pass** — depth-only render from light's perspective into a 2048×2048 texture; culled against light frustum
2. **Scene pass** — Blinn-Phong shading with PCF soft shadows; culled against camera frustum
3. **Screen pass** — FXAA anti-aliasing + contrast/saturation grade on a fullscreen quad

## Tech Stack

- **Language:** TypeScript 6 (strict mode, ES2020 target)
- **Build:** tsup (library) + esbuild (demo), with custom loaders for `.glsl` and `.obj`
- **Rendering:** WebGL 2.0 — no external graphics libraries
- **Linting:** ESLint 9 + typescript-eslint + Prettier
