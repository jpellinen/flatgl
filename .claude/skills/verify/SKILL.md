---
name: verify
description: Verify FlatGL changes by rendering through the real engine in headless Chrome and screenshotting the result.
---

# Verifying FlatGL changes

FlatGL is a browser WebGL2 library — the surface is a rendered canvas, not Node. `dist/index.js` is dependency-free ESM, so no bundler is needed for a harness page.

## Recipe

1. `npm run build` — produces `dist/index.js`.
2. Copy `dist/index.js` into a scratch dir as `flatgl.js`, next to a minimal HTML page:
   - `<canvas id="glcanvas" width="1280" height="720">`, then `<script type="module">` importing `{ Engine, ... } from './flatgl.js'` and building a scene that exercises the change. `engine.showStats(true)` puts draw-call/triangle counts in the screenshot — useful evidence.
3. Serve the scratch dir: `python3 -m http.server 8931 &`
4. Screenshot with headless Chrome (works, WebGL2 via SwiftShader, ~20–30 FPS):

   ```
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
     --headless=new --disable-gpu-sandbox --window-size=1280,720 \
     --virtual-time-budget=4000 --screenshot=shot.png http://localhost:8931/
   ```

5. Read the PNG. Kill the server (`pkill -f "http.server 8931"`).

## Gotchas

- `dist/index.js` cannot be imported in Node — it touches `WebGL2RenderingContext` at module scope.
- `npm run dev:demo` serves the full demo on port 8080 (`examples/demo.ts`, imports from `../src`), useful when the change is already exercised by the demo scene.
- Backface culling is on (CCW front faces) — an inside-out mesh shows as invisible/hollow faces, so screenshot from more than one angle when verifying geometry.
