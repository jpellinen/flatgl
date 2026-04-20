# FlatGL

A lightweight 3D WebGL 2.0 renderer built around an Entity-Component-System (ECS) architecture. Zero runtime dependencies — just TypeScript and direct WebGL2 API calls.

![WebGL2](https://img.shields.io/badge/WebGL-2.0-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue)

## Features

- **ECS architecture** — entities, components, and systems with type-safe queries
- **Multi-pass rendering** — shadow pass → scene pass → post-process pass
- **Shadow mapping** — directional light with depth texture and PCF sampling
- **Post-processing** — vignette blur using golden-angle spiral sampling
- **Orbit camera** — mouse/pointer drag to orbit around the scene
- **OBJ loader** — parses geometry with positions, normals, and UVs
- **Responsive** — handles window resize with proper DPI scaling

## Getting Started

```bash
npm install
npm run dev
```

Then open `index.html` in a browser with WebGL2 support. Click and drag to orbit the camera.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Build in watch mode (esbuild) |
| `npm run build` | One-time production build |
| `npm run lint` | Run ESLint on `src/` |

Output is written to `dist/bundle.js` and loaded by `index.html`.

## Project Structure

```
src/
├── index.ts              # Entry point; initializes ECS and render loop
├── config.ts             # All tunable constants (shadow, camera, lighting, input)
├── core/                 # ECS primitives (World, Entity, System)
├── components/           # Data components (Mesh, Material, Transform, Camera, Light)
├── systems/              # Logic systems (RenderSystem, ShadowSystem, InputSystem)
├── renderer/             # WebGL2 wrappers (Shader, Buffer, Texture, Framebuffer)
├── math/                 # Vec3 and Mat4 utilities
├── loaders/              # OBJ file parser
├── shaders/              # GLSL 3.00 ES shaders
└── assets/               # .obj model files
```

## Rendering Pipeline

1. **Shadow pass** — renders scene depth from the light's perspective into a 512×512 depth texture
2. **Scene pass** — renders geometry with diffuse lighting, PCF shadow sampling, and a checkerboard ground plane
3. **Post-process pass** — fullscreen quad applies a vignette blur effect

## Configuration

All constants are in [src/config.ts](src/config.ts). Key settings:

- `SHADOW_MAP_SIZE` — depth texture resolution (default `512`)
- `LIGHT_POSITION` / `LIGHT_DIRECTION` — directional light placement
- `LIGHT_INTENSITY` / `AMBIENT_INTENSITY` — diffuse and ambient strength
- `CAMERA_POSITION` / `CAMERA_FOV` — initial camera placement and field of view
- `ORBIT_SENSITIVITY` — mouse drag rotation scale

## Tech Stack

- **Language:** TypeScript 6 (strict mode, ES2020 target)
- **Build:** esbuild with custom loaders for `.glsl` and `.obj` files
- **Rendering:** WebGL 2.0 — no external graphics libraries
- **Linting:** ESLint 9 + typescript-eslint + Prettier
