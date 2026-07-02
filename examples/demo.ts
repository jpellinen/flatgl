import {
  Engine,
  Script,
  Transform,
  Vec3,
  ObjLoader,
  //GltfLoader,
} from '../src/index';
import type { ScriptBehavior, Entity } from '../src/index';
import type { World } from '../src/core/World';

import skyBoxPng from './assets/skybox.png';
import groundSrc from './assets/ground.obj';
import groundPng from './assets/ground.png';
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
//import testanimSrc from './assets/testanim.glb';

function showError(err: unknown): void {
  const div = document.createElement('div');
  div.style.cssText =
    'position:fixed;top:0;left:0;right:0;background:red;color:#fff;padding:12px;font:14px monospace;white-space:pre-wrap;z-index:9999';
  div.textContent =
    err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
  document.body.appendChild(div);
}

async function init(): Promise<void> {
  const canvas = document.getElementById('glcanvas');
  if (!(canvas instanceof HTMLCanvasElement))
    throw new Error('Canvas not found');

  const engine = Engine.create({
    canvas,
    clearColor: new Vec3(0.55, 0.78, 1.0),
    light: { direction: new Vec3(1, 2, 1) },
    postProcess: {
      fxaa: true,
      saturation: 1.1,
    },
  });

  const { world, input, assets } = engine;

  const skyboxTex = await assets.loadTexture(skyBoxPng);
  engine.setSkybox(skyboxTex);

  const groundTex = await assets.loadTexture(groundPng);
  const treeTex = await assets.loadTexture(treePng);
  const logTex = await assets.loadTexture(logPng);
  const rockTex = await assets.loadTexture(rockPng);
  const grassTex = await assets.loadTexture(grassPng);
  const campfireTex = await assets.loadTexture(campfirePng);
  const fireTex = await assets.loadTexture(firePng);

  const treeMesh = assets.createMesh(ObjLoader.parse(treeSrc));
  const treeMat = assets.createMaterial({
    texture: treeTex,
  });

  const logMesh = assets.createMesh(ObjLoader.parse(logSrc));
  const logMat = assets.createMaterial({
    texture: logTex,
  });

  const rockMesh = assets.createMesh(ObjLoader.parse(rockSrc));
  const rockMat = assets.createMaterial({
    texture: rockTex,
  });

  const grassMesh = assets.createMesh(ObjLoader.parse(grassSrc));
  const grassMat = assets.createMaterial({
    texture: grassTex,
  });

  const campfireMesh = assets.createMesh(ObjLoader.parse(campfireSrc));
  const campfireMat = assets.createMaterial({
    texture: campfireTex,
  });

  const groundMesh = assets.createMesh(ObjLoader.parse(groundSrc));
  const groundMat = assets.createMaterial({
    texture: groundTex,
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
    [new Vec3(-0.75, 0, -1.1), logBaseRot],
    [new Vec3(-0.8, 0.1, 1.4), logBaseRot + (2 / 3) * Math.PI],
    [new Vec3(1.4, 0.05, 0.35), logBaseRot + (4 / 3) * Math.PI],
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
      new Transform(new Vec3(x, 0.3, z), new Vec3(0, ry, 0), new Vec3(s, s, s)),
    );
  }

  // Rocks — varied scale and rotation
  for (const [x, z, ry, s] of [
    [2.5, 0.6, 0.0, 0.55],
    [2.4, -2.1, 1.1, 1.05],
    [0.8, -2.6, 1.9, 0.7],
    [-2.5, -1.0, 0.7, 0.4],
    [2.4, -0.8, 1.9, 0.35],
  ]) {
    const e = world.create();
    world.add(e, rockMesh);
    world.add(e, rockMat);
    world.add(
      e,
      new Transform(
        new Vec3(x, 0.35, z),
        new Vec3(0, ry, 0),
        new Vec3(s, s, s),
      ),
    );
  }

  // Grass patches — varied scale and rotation
  for (const [x, y, z, ry, s] of [
    [0.9, 0.475, 2.5, 0.4, 1.1],
    [-0.75, 0.6, 2.5, 1.9, 1.2],
    [0.25, 0.45, -3.0, 0.7, 1.0],
    [-2.9, 0.5, -2.1, 2.3, 1.2],
    [1.9, 0.35, -1.35, 1.1, 1.0],
    [-2.45, 0.35, -0.2, -0.1, 0.9],
  ]) {
    const e = world.create();
    world.add(e, grassMesh);
    world.add(e, grassMat);
    world.add(
      e,
      new Transform(new Vec3(x, y, z), new Vec3(0, ry, 0), new Vec3(s, s, s)),
    );
  }

  // Test animation
  /*const { mesh, skeleton, animator } = await engine.assets.createGltf(
    GltfLoader.fromBuffer(testanimSrc),
  );
  const material = engine.assets.createSkinnedMaterial({
    color: new Vec3(1, 1, 1),
  });
  const entity = engine.world.create();
  engine.world.add(entity, mesh);
  engine.world.add(entity, skeleton);
  engine.world.add(entity, animator);
  engine.world.add(entity, material);
  engine.world.add(
    entity,
    new Transform(new Vec3(-1.5, 0, 0), new Vec3(0, 0, 0), new Vec3(0.5, 0.5, 0.5)),
  );*/

  const fireEmitter = assets.createParticleEmitter({
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
    new Transform(
      new Vec3(0, 0.2, 0),
      new Vec3(0, 0, 0),
      new Vec3(1, 1, 1),
      campfire,
    ),
  );
  world.add(fireOrigin, fireEmitter);

  // Orbit camera: auto-rotate, drag to orbit, scroll to zoom
  class OrbitCamera implements ScriptBehavior {
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

// Yield past a paint frame so the loader is visible before the engine blocks the thread.
new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)))
  .then(init)
  .catch(showError)
  .finally(() => document.getElementById('loader')?.remove());
