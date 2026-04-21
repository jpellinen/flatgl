# Project Plan & Tech Debt

## What the project does

3D WebGL 2.0 renderer with an ECS (Entity-Component-System) architecture. Renders a cube and plane with shadow mapping (directional light) and a post-processing vignette blur pass. Interactive camera with mouse/pointer orbit controls. TypeScript with proper type safety.

---

## Tech Debt

None outstanding — all items resolved.

---

## Next Features

- **Auto-rotate** — gentle idle spin when not dragging; pause on pointerdown
- **Scroll to zoom** — `wheel` listener in `InputSystem` to adjust orbit radius
- **Specular highlights** — Blinn-Phong specular term in `scene.frag.glsl` (~4 lines)
- **Sharper shadows** — bump `SHADOW_MAP_SIZE` to 1024 and add Poisson disk offsets to the PCF loop
