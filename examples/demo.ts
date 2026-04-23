import { Engine, Script, Transform, Vec3, ObjLoader } from '../src/index';
import type { ScriptBehaviour, Entity } from '../src/index';
import type { World } from '../src/core/World';

import treeSrc from './assets/tree.obj';
import treePng from './assets/tree.png';
import rockSrc from './assets/rock.obj';
import rockPng from './assets/rock.png';
import campfireSrc from './assets/campfire.obj';
import campfirePng from './assets/campfire.png';

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

  const checkerTex = engine.createTexture(checkerboard(8), 8, 8);
  const treeTex = await engine.loadTexture(treePng);
  const rockTex = await engine.loadTexture(rockPng);
  const campfireTex = await engine.loadTexture(campfirePng);

  const treeMesh = engine.createMesh(ObjLoader.parse(treeSrc));
  const treeMat = engine.createMaterial({
    texture: treeTex,
    specular: 0.0,
  });

  const rockMesh = engine.createMesh(ObjLoader.parse(rockSrc));
  const rockMat = engine.createMaterial({
    texture: rockTex,
  });

  const campfireMesh = engine.createMesh(ObjLoader.parse(campfireSrc));
  const campfireMat = engine.createMaterial({
    texture: campfireTex,
    specular: 0.0,
  });

  const groundMesh = engine.createMesh(makePlane(6));
  const groundMat = engine.createMaterial({
    color: new Vec3(0.5, 0.75, 0.5),
    //texture: checkerTex,
  });

  const ground = world.create();
  world.add(ground, groundMesh);
  world.add(ground, groundMat);
  world.add(ground, new Transform(new Vec3(0, 0, 0)));

  const tree = world.create();
  world.add(tree, treeMesh);
  world.add(tree, treeMat);
  world.add(tree, new Transform(new Vec3(-2, 0, 2)));

  const rock = world.create();
  world.add(rock, rockMesh);
  world.add(rock, rockMat);
  world.add(rock, new Transform(new Vec3(2, 0, 0)));

  const campfire = world.create();
  world.add(campfire, campfireMesh);
  world.add(campfire, campfireMat);
  world.add(campfire, new Transform());

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
  window.addEventListener('beforeunload', () => {
    stop();
    engine.destroy();
  });
}

init().catch(showError);
