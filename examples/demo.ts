import { Engine, Script, Transform, Vec3, ObjLoader } from '../src/index';
import type { ScriptBehaviour, Entity } from '../src/index';
import type { World } from '../src/core/World';
import modelSrc from '../src/assets/monkey.obj';

function showError(err: unknown): void {
  const div = document.createElement('div');
  div.style.cssText =
    'position:fixed;top:0;left:0;right:0;background:red;color:#fff;padding:12px;font:14px monospace;white-space:pre-wrap;z-index:9999';
  div.textContent =
    err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
  document.body.appendChild(div);
}

function checkerboard(size: number): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = (x + y) % 2 === 0 ? 255 : 128;
      const i = (y * size + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return data;
}

function makePlane(halfExtent: number): {
  vertices: Float32Array;
  indices: Uint16Array;
} {
  const e = halfExtent;
  // prettier-ignore
  const vertices = new Float32Array([
    -e, 0, -e,  0, 1, 0,  0, 1,
     e, 0, -e,  0, 1, 0,  1, 1,
     e, 0,  e,  0, 1, 0,  1, 0,
    -e, 0,  e,  0, 1, 0,  0, 0,
  ]);
  const indices = new Uint16Array([0, 2, 1, 0, 3, 2]);
  return { vertices, indices };
}

try {
  const canvas = document.getElementById('glcanvas');
  if (!(canvas instanceof HTMLCanvasElement))
    throw new Error('Canvas not found');

  const engine = Engine.create({
    canvas,
    camera: { height: 10, pitch: Math.PI / 3 },
    light: { direction: new Vec3(1, 2, 1) },
    postProcess: { fxaa: true, saturation: 1.1 },
  });

  const { world, input } = engine;

  const checkerTex = engine.createTexture(checkerboard(8), 8, 8);

  const modelMesh = engine.createMesh(ObjLoader.parse(modelSrc));
  const modelMat = engine.createMaterial({
    color: new Vec3(0.9, 0.8, 0.6),
    texture: checkerTex,
  });

  const groundMesh = engine.createMesh(makePlane(6));
  const groundMat = engine.createMaterial({
    color: new Vec3(0.5, 0.75, 0.5),
    texture: checkerTex,
  });

  // Ground plane (static, no script)
  const ground = world.create();
  world.add(ground, groundMesh);
  world.add(ground, groundMat);
  world.add(ground, new Transform(new Vec3(0, -1, 0)));

  // Player entity with WASD movement
  class PlayerMove implements ScriptBehaviour {
    private speed = 5;

    onUpdate(entity: Entity, w: World, dt: number): void {
      const t = w.get(entity, Transform)!;
      const dx =
        (input.isDown('d') || input.isDown('ArrowRight') ? 1 : 0) -
        (input.isDown('a') || input.isDown('ArrowLeft') ? 1 : 0);
      const dz =
        (input.isDown('s') || input.isDown('ArrowDown') ? 1 : 0) -
        (input.isDown('w') || input.isDown('ArrowUp') ? 1 : 0);
      const move = new Vec3(dx, 0, dz);
      if (move.length() > 0) {
        const dir = move.normalize();
        t.position = t.position.add(dir.scale(this.speed * dt));
        t.rotation = new Vec3(0, Math.atan2(dir.x, dir.z), 0);
      }
      engine.camera.target = t.position;
    }
  }

  const player = world.create();
  world.add(player, modelMesh);
  world.add(player, modelMat);
  world.add(player, new Transform());
  world.add(player, new Script(new PlayerMove()));

  const stop = engine.start();
  window.addEventListener('beforeunload', () => {
    stop();
    engine.destroy();
  });
} catch (err) {
  showError(err);
}
