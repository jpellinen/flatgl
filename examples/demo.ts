import { Mat4 } from '../src/math/Mat4';
import { Vec3 } from '../src/math/Vec3';
import { Buffer } from '../src/renderer/Buffer';
import { Framebuffer } from '../src/renderer/Framebuffer';
import { RenderContext } from '../src/renderer/RenderContext';
import { Shader } from '../src/renderer/Shader';
import { Texture } from '../src/renderer/Texture';
import { Camera } from '../src/components/Camera';
import { DirectionalLight } from '../src/components/DirectionalLight';
import { Input } from '../src/components/Input';
import { Material } from '../src/components/Material';
import { Mesh } from '../src/components/Mesh';
import { Script } from '../src/components/Script';
import { Transform } from '../src/components/Transform';
import type { ScriptBehaviour } from '../src/components/Script';
import type { Entity } from '../src/core/Entity';
import { World } from '../src/core/World';
import { InputSystem } from '../src/systems/InputSystem';
import { RenderSystem } from '../src/systems/RenderSystem';
import { ScriptSystem } from '../src/systems/ScriptSystem';
import { ShadowSystem } from '../src/systems/ShadowSystem';
import { ObjLoader } from '../src/loaders/ObjLoader';
import {
  AMBIENT_INTENSITY,
  AUTO_ROTATE_SPEED,
  CAMERA_FAR,
  CAMERA_FOV,
  CAMERA_NEAR,
  CAMERA_POSITION,
  CHECKER_DARK,
  CHECKER_LIGHT,
  CHECKER_SIZE,
  LIGHT_DIRECTION,
  LIGHT_INTENSITY,
  LIGHT_POSITION,
  ORBIT_PITCH_CLAMP,
  ORBIT_SENSITIVITY,
  ORBIT_ZOOM_MAX,
  ORBIT_ZOOM_MIN,
  ORBIT_ZOOM_SENSITIVITY,
  PLANE_HALF_EXTENT,
  SHADOW_LIGHT_FAR,
  SHADOW_LIGHT_NEAR,
  SHADOW_MAP_SIZE,
  SHADOW_ORTHO_EXTENT,
} from '../src/config';
import modelSrc from '../src/assets/monkey.obj';
import sceneFS from '../src/shaders/scene.frag.glsl';
import sceneVS from '../src/shaders/scene.vert.glsl';
import screenFS from '../src/shaders/screen.frag.glsl';
import screenVS from '../src/shaders/screen.vert.glsl';
import shadowFS from '../src/shaders/shadow.frag.glsl';
import shadowVS from '../src/shaders/shadow.vert.glsl';

class CameraOrbitBehaviour implements ScriptBehaviour {
  onUpdate(entity: Entity, world: World, dt: number): void {
    const camera = world.get(entity, Camera);
    const input = world.get(entity, Input);
    if (!camera || !input) return;

    const offset = camera.position.sub(camera.target);
    let r = offset.length();
    const theta = Math.atan2(offset.x, offset.z);
    const phi = Math.asin(Math.max(-1, Math.min(1, offset.y / r)));

    if (input.dZoom !== 0) {
      r = Math.max(
        ORBIT_ZOOM_MIN,
        Math.min(ORBIT_ZOOM_MAX, r + input.dZoom * ORBIT_ZOOM_SENSITIVITY * r),
      );
    }

    let newTheta = theta;
    let newPhi = phi;
    if (input.dx !== 0 || input.dy !== 0) {
      newTheta = theta - input.dx * ORBIT_SENSITIVITY;
      newPhi = Math.max(
        -Math.PI / 2 + ORBIT_PITCH_CLAMP,
        Math.min(
          Math.PI / 2 - ORBIT_PITCH_CLAMP,
          phi + input.dy * ORBIT_SENSITIVITY,
        ),
      );
    } else if (!input.dragging) {
      newTheta = theta - AUTO_ROTATE_SPEED * dt;
    }

    camera.position = camera.target.add(
      new Vec3(
        r * Math.cos(newPhi) * Math.sin(newTheta),
        r * Math.sin(newPhi),
        r * Math.cos(newPhi) * Math.cos(newTheta),
      ),
    );
  }
}

function showError(err: Error) {
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
      const v = (x + y) % 2 === 0 ? CHECKER_LIGHT : CHECKER_DARK;
      const i = (y * size + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return data;
}

function createScenePass(
  context: RenderContext,
  canvas: HTMLCanvasElement,
  fb: Framebuffer,
): {
  world: World;
  pass: RenderSystem;
  modelMaterial: Material;
  planeMaterial: Material;
  checkerTex: Texture;
} {
  const shader = Shader.fromSource(context, sceneVS, sceneFS);
  const modelMaterial = new Material(context, shader);
  const planeMaterial = new Material(context, shader);

  const stride = 8 * 4;
  const { vertices, indices } = ObjLoader.parse(modelSrc);
  const buffer = new Buffer(context, vertices);
  const mesh = new Mesh(
    context,
    buffer,
    [
      { loc: shader.attribLocation('a_position'), size: 3, stride, offset: 0 },
      {
        loc: shader.attribLocation('a_normal'),
        size: 3,
        stride,
        offset: 3 * 4,
      },
      { loc: shader.attribLocation('a_uv'), size: 2, stride, offset: 6 * 4 },
    ],
    { indices },
  );

  const checkerTex = Texture.fromData(
    context,
    checkerboard(CHECKER_SIZE),
    CHECKER_SIZE,
    CHECKER_SIZE,
  );
  modelMaterial.bind();
  modelMaterial.setTexture('u_texture', checkerTex, 0);
  modelMaterial.setVec3('u_baseColor', 1, 1, 1);

  planeMaterial.bind();
  planeMaterial.setTexture('u_texture', checkerTex, 0);
  planeMaterial.setVec3('u_baseColor', 0.55, 0.75, 0.55);

  // prettier-ignore
  const planeVerts = new Float32Array([
    -PLANE_HALF_EXTENT,0,-PLANE_HALF_EXTENT,  0,1,0,  0,1,
     PLANE_HALF_EXTENT,0,-PLANE_HALF_EXTENT,  0,1,0,  1,1,
     PLANE_HALF_EXTENT,0, PLANE_HALF_EXTENT,  0,1,0,  1,0,
    -PLANE_HALF_EXTENT,0, PLANE_HALF_EXTENT,  0,1,0,  0,0,
  ]);
  const planeBuf = new Buffer(context, planeVerts);
  const planeMesh = new Mesh(
    context,
    planeBuf,
    [
      {
        loc: planeMaterial.shader.attribLocation('a_position'),
        size: 3,
        stride,
        offset: 0,
      },
      {
        loc: planeMaterial.shader.attribLocation('a_normal'),
        size: 3,
        stride,
        offset: 3 * 4,
      },
      {
        loc: planeMaterial.shader.attribLocation('a_uv'),
        size: 2,
        stride,
        offset: 6 * 4,
      },
    ],
    { indices: new Uint16Array([0, 2, 1, 0, 3, 2]) },
  );

  const world = new World();
  const objEntity = world.create();
  world.add(objEntity, mesh);
  world.add(objEntity, modelMaterial);
  world.add(
    objEntity,
    new Transform(new Vec3(0, 0, 0), undefined, new Vec3(1, 1, 1)),
  );

  const planeEntity = world.create();
  world.add(planeEntity, planeMesh);
  world.add(planeEntity, planeMaterial);
  world.add(planeEntity, new Transform(new Vec3(0, -1, 0)));

  const lightEntity = world.create();
  const lightDir = new Vec3(...LIGHT_DIRECTION).normalize();
  world.add(
    lightEntity,
    new DirectionalLight(
      lightDir,
      new Vec3(1, 1, 1),
      LIGHT_INTENSITY,
      AMBIENT_INTENSITY,
    ),
  );

  const camera = new Camera(
    new Vec3(...CAMERA_POSITION),
    new Vec3(0, 0, 0),
    new Vec3(0, 1, 0),
    CAMERA_FOV,
    CAMERA_NEAR,
    CAMERA_FAR,
  );
  const cameraEntity = world.create();
  world.add(cameraEntity, camera);
  world.add(cameraEntity, new Input());
  world.add(cameraEntity, new Script(new CameraOrbitBehaviour()));

  const aspect = canvas.width / canvas.height;
  return {
    world,
    pass: new RenderSystem(context, world, fb, aspect),
    modelMaterial,
    planeMaterial,
    checkerTex,
  };
}

function createScreenPass(
  context: RenderContext,
  fb: Framebuffer,
  aspect: number,
): { pass: RenderSystem; material: Material; world: World } {
  const shader = Shader.fromSource(context, screenVS, screenFS);
  const material = new Material(context, shader);

  const stride = 4 * 4;
  const buffer = new Buffer(
    context,
    new Float32Array([-1, -1, 0, 0, 1, -1, 1, 0, 1, 1, 1, 1, -1, 1, 0, 1]),
  );
  const mesh = new Mesh(
    context,
    buffer,
    [
      { loc: shader.attribLocation('a_position'), size: 2, stride, offset: 0 },
      { loc: shader.attribLocation('a_uv'), size: 2, stride, offset: 2 * 4 },
    ],
    { indices: new Uint16Array([0, 1, 2, 0, 2, 3]) },
  );

  material.bind();
  material.setTexture('u_screen', fb.texture, 0);
  material.setFloat('u_aspect', aspect);

  const world = new World();
  const quadEntity = world.create();
  world.add(quadEntity, mesh);
  world.add(quadEntity, material);

  return { pass: new RenderSystem(context, world), material, world };
}

function init(): void {
  const el = document.getElementById('glcanvas');
  if (!(el instanceof HTMLCanvasElement)) throw new Error('Canvas not found');
  const canvas: HTMLCanvasElement = el;

  const context = RenderContext.create(canvas);
  const shadowFb = Framebuffer.createDepthOnly(
    context,
    SHADOW_MAP_SIZE,
    SHADOW_MAP_SIZE,
  );

  const lightPos = new Vec3(...LIGHT_POSITION);
  const lightView = Mat4.lookAt(lightPos, new Vec3(0, 0, 0), new Vec3(0, 1, 0));
  const lightProj = Mat4.ortho(
    -SHADOW_ORTHO_EXTENT,
    SHADOW_ORTHO_EXTENT,
    -SHADOW_ORTHO_EXTENT,
    SHADOW_ORTHO_EXTENT,
    SHADOW_LIGHT_NEAR,
    SHADOW_LIGHT_FAR,
  );
  const lightSpaceMat = lightProj.multiply(lightView);

  // initial fb at 1×1; resize() below sets real dimensions before first frame
  let fb = Framebuffer.create(context, 1, 1);

  const {
    world: sceneWorld,
    pass: pass1,
    modelMaterial,
    planeMaterial,
    checkerTex,
  } = createScenePass(context, canvas, fb);

  for (const mat of [modelMaterial, planeMaterial]) {
    mat.bind();
    mat.setTexture('u_shadowMap', shadowFb.texture, 1);
    mat.setMatrix4('u_lightSpaceMatrix', lightSpaceMat.array);
  }

  const shadowShader = Shader.fromSource(context, shadowVS, shadowFS);
  const shadowPass = new ShadowSystem(
    context,
    sceneWorld,
    shadowFb,
    shadowShader,
    lightSpaceMat,
  );

  const {
    pass: pass2,
    material: screenMaterial,
    world: screenWorld,
  } = createScreenPass(context, fb, 1);
  const inputSystem = new InputSystem(canvas, sceneWorld);
  const scriptSystem = new ScriptSystem(sceneWorld);

  function resize(): void {
    canvas.width = Math.round(canvas.clientWidth * devicePixelRatio);
    canvas.height = Math.round(canvas.clientHeight * devicePixelRatio);
    const aspect = canvas.width / canvas.height;
    const newFb = Framebuffer.create(context, canvas.width, canvas.height);
    pass1.setTarget(newFb);
    pass1.setAspect(aspect);
    screenMaterial.bind();
    screenMaterial.setTexture('u_screen', newFb.texture, 0);
    screenMaterial.setFloat('u_aspect', aspect);
    fb.destroy();
    fb = newFb;
  }

  function cleanup(): void {
    cancelAnimationFrame(rafHandle);
    window.removeEventListener('resize', resize);
    inputSystem.destroy();
    scriptSystem.destroyAll();
    shadowPass.destroy();
    shadowFb.destroy();
    fb.destroy();
    checkerTex.destroy();
    sceneWorld.destroyAll();
    screenWorld.destroyAll();
  }

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('beforeunload', cleanup);

  let rafHandle = 0;
  let lastTime = 0;
  function loop(time: number): void {
    try {
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      inputSystem.update();
      scriptSystem.update(dt);
      shadowPass.update();
      pass1.update();
      pass2.update();
    } catch (err) {
      showError(err as Error);
      return;
    }
    rafHandle = requestAnimationFrame(loop);
  }
  rafHandle = requestAnimationFrame(loop);
}

try {
  init();
} catch (err) {
  showError(err as Error);
}
