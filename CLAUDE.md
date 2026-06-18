# FlatGL

## Key documents

- **[README.md](README.md)** — public API reference, quickstart code, feature list, and render pipeline overview. Read this to understand what the engine exposes to users and how the four rendering passes are sequenced.
- **[docs/architecture.md](docs/architecture.md)** — internal architecture: ECS design, system dispatch order, GPU resource ownership rules, known design constraints, and the layer map from `Engine` down to the WebGL2 wrappers. Read this before touching any system, renderer class, or the World/Component boundary.
- **[PLAN.md](PLAN.md)** — prioritised list of confirmed bugs and performance issues from the last full audit (memory leaks, correctness bugs, GC hot-paths). Check here before working on any of those areas to avoid duplicating investigation.

## Formatting

After every file edit run Prettier on the changed file:

```
npx prettier --write <file>
```

Config is in `.prettierrc`: single quotes, semicolons, 2-space indent.
