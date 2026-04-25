import { Engine, Script, Transform, Vec3, ObjLoader } from '../src/index';
import type { ScriptBehaviour, Entity } from '../src/index';
import type { World } from '../src/core/World';

import treeSrc from './assets/tree.obj';
import treePng from './assets/tree.png';
import logSrc from './assets/log.obj';
import logPng from './assets/log.png';
import rockSrc from './assets/rock.obj';
import rockPng from './assets/rock.png';
import grassSrc from './assets/grass.obj';
import grassPng from './assets/grass.png';
import campfireSrc from './assets/campfire.obj';
import campfirePng from './assets/campfire.png';
import firePng from './assets/fire.png';

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
      const v = (x + y) % 2 === 0 ? 255 : 236;
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

async function init(): Promise<void> {
  const canvas = document.getElementById('glcanvas');
  if (!(canvas instanceof HTMLCanvasElement))
    throw new Error('Canvas not found');

  const engine = Engine.create({
    canvas,
    light: { direction: new Vec3(1, 2, 1) },
    postProcess: { fxaa: true, saturation: 1.1 },
  });

  const { world, input } = engine;

  const checkerTex = engine.assets.createTexture(checkerboard(8), 8, 8);
  const treeTex = await engine.assets.loadTexture(treePng);
  const logTex = await engine.assets.loadTexture(logPng);
  const rockTex = await engine.assets.loadTexture(rockPng);
  const grassTex = await engine.assets.loadTexture(grassPng);
  const campfireTex = await engine.assets.loadTexture(campfirePng);
  const fireTex = await engine.assets.loadTexture(firePng);

  const treeMesh = engine.assets.createMesh(ObjLoader.parse(treeSrc));
  const treeMat = engine.assets.createMaterial({
    texture: treeTex,
    specular: 0.0,
  });

  const logMesh = engine.assets.createMesh(ObjLoader.parse(logSrc));
  const logMat = engine.assets.createMaterial({
    texture: logTex,
    specular: 0.0,
  });

  const rockMesh = engine.assets.createMesh(ObjLoader.parse(rockSrc));
  const rockMat = engine.assets.createMaterial({
    texture: rockTex,
  });

  const grassMesh = engine.assets.createMesh(ObjLoader.parse(grassSrc));
  const grassMat = engine.assets.createMaterial({
    texture: grassTex,
  });

  const campfireMesh = engine.assets.createMesh(ObjLoader.parse(campfireSrc));
  const campfireMat = engine.assets.createMaterial({
    texture: campfireTex,
    specular: 0.0,
  });

  const groundMesh = engine.assets.createMesh(makePlane(4));
  const groundMat = engine.assets.createMaterial({
    color: new Vec3(0.6, 0.9, 0.4),
    texture: checkerTex,
  });

  const ground = world.create();
  world.add(ground, groundMesh);
  world.add(ground, groundMat);
  world.add(ground, new Transform());

  // Campfire at center
  const campfire = world.create();
  world.add(campfire, campfireMesh);
  world.add(campfire, campfireMat);
  world.add(campfire, new Transform());

  // Three logs radiating outward from the fire, ~120° apart.
  // Each rotation steps by 2π/3 from the first so they spread evenly.
  const logBaseRot = -Math.PI * 0.35;
  for (const [pos, ry] of [
    [new Vec3(-0.65, 0, -1.4), logBaseRot],
    [new Vec3(-0.8, 0, 1.4), logBaseRot + (2 / 3) * Math.PI],
    [new Vec3(1.4, 0, 0.35), logBaseRot + (4 / 3) * Math.PI],
  ] as [Vec3, number][]) {
    const e = world.create();
    world.add(e, logMesh);
    world.add(e, logMat);
    world.add(e, new Transform(pos, new Vec3(0, ry, 0)));
  }

  // Trees ringing the clearing — varied scale
  for (const [x, z, ry, s] of [
    [-1.15, 3.1, 0.3, 1.0],
    [2.6, 2.25, 1.8, 1.15],
    [3.2, -0.1, 0.9, 0.85],
    [-1.15, -2.95, 2.5, 1.1],
    [-2.9, 0.2, 1.2, 0.9],
  ]) {
    const e = world.create();
    world.add(e, treeMesh);
    world.add(e, treeMat);
    world.add(
      e,
      new Transform(new Vec3(x, 0, z), new Vec3(0, ry, 0), new Vec3(s, s, s)),
    );
  }

  // Rocks — varied scale and rotation
  for (const [x, z, ry, s] of [
    [2.5, 0.6, 0.0, 0.55],
    [-2.4, 2.1, 1.1, 1.05],
    [1.0, -1.1, 1.9, 0.7],
    [-3.2, -1.7, 0.7, 0.4],
    [1.85, -1.0, 1.9, 0.35],
  ]) {
    const e = world.create();
    world.add(e, rockMesh);
    world.add(e, rockMat);
    world.add(
      e,
      new Transform(new Vec3(x, 0, z), new Vec3(0, ry, 0), new Vec3(s, s, s)),
    );
  }

  // Grass patches — varied scale and rotation
  for (const [x, z, ry, s] of [
    [0.9, 2.5, 0.4, 1.1],
    [-0.85, 2.25, 1.9, 1.2],
    [0.25, -3.0, 0.7, 1.0],
    [-2.9, -2.1, 2.3, 1.2],
    [2.2, -1.55, 1.1, 1.0],
    [-1.35, -0.6, -0.1, 0.9],
  ]) {
    const e = world.create();
    world.add(e, grassMesh);
    world.add(e, grassMat);
    world.add(
      e,
      new Transform(new Vec3(x, 0, z), new Vec3(0, ry, 0), new Vec3(s, s, s)),
    );
  }

  const fireEmitter = engine.assets.createParticleEmitter({
    rate: 10,
    lifetime: 1.4,
    speed: 0.8,
    spread: 0.2,
    color: new Vec3(1.0, 0.5, 0.1),
    colorEnd: new Vec3(0.3, 0.1, 0.0),
    size: 0.4,
    sizeEnd: 0.0,
    gravity: 0.0,
    texture: fireTex,
  });
  const fireOrigin = world.create();
  world.add(
    fireOrigin,
    new Transform(new Vec3(0, 0.2, 0), undefined, undefined, campfire),
  );
  world.add(fireOrigin, fireEmitter);

  // Orbit camera: auto-rotate, drag to orbit, scroll to zoom
  class OrbitCamera implements ScriptBehaviour {
    private theta = 0.4;
    private phi = 0.45;
    private radius = 10;
    private lastMouseX = 0;
    private lastMouseY = 0;

    onUpdate(_entity: Entity, _world: World, dt: number): void {
      if (input.mouseHeld) {
        this.theta -= (input.mousePixel.x - this.lastMouseX) * 0.005;
        this.phi = Math.max(
          0.05,
          Math.min(
            Math.PI / 2 - 0.05,
            this.phi + (input.mousePixel.y - this.lastMouseY) * 0.005,
          ),
        );
      } else {
        this.theta += 0.4 * dt;
      }

      this.lastMouseX = input.mousePixel.x;
      this.lastMouseY = input.mousePixel.y;

      if (input.wheelDelta !== 0) {
        this.radius = Math.max(
          2,
          Math.min(40, this.radius + input.wheelDelta * 0.01),
        );
      }

      engine.camera.position = new Vec3(
        this.radius * Math.cos(this.phi) * Math.sin(this.theta),
        this.radius * Math.sin(this.phi) + 1,
        this.radius * Math.cos(this.phi) * Math.cos(this.theta),
      );
      engine.camera.target = new Vec3(0, 1, 0);
    }
  }

  world.add(engine.cameraEntity, new Script(new OrbitCamera()));

  const stop = engine.start();
  engine.showStats();
  window.addEventListener('beforeunload', () => {
    stop();
    engine.destroy();
  });
}

init().catch(showError);
