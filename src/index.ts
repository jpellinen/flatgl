import { Mat4 } from '@/math/Mat4';
import { Vec3 } from '@/math/Vec3';
import { Buffer } from '@/renderer/Buffer';
import { Framebuffer } from '@/renderer/Framebuffer';
import { RenderContext } from '@/renderer/RenderContext';
import { Shader } from '@/renderer/Shader';
import { Texture } from '@/renderer/Texture';
import { Camera } from '@/components/Camera';
import { DirectionalLight } from '@/components/DirectionalLight';
import { Material } from '@/components/Material';
import { Mesh } from '@/components/Mesh';
import { Transform } from '@/components/Transform';
import { World } from '@/core/World';
import { InputSystem } from '@/systems/InputSystem';
import { RenderSystem } from '@/systems/RenderSystem';
import { ShadowSystem } from '@/systems/ShadowSystem';
import { ObjLoader } from '@/loaders/ObjLoader';
import {
  AMBIENT_INTENSITY,
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
  PLANE_HALF_EXTENT,
  SHADOW_LIGHT_FAR,
  SHADOW_LIGHT_NEAR,
  SHADOW_MAP_SIZE,
  SHADOW_ORTHO_EXTENT,
} from '@/config';
import cubeObj from './assets/teapot2.obj';
import sceneFS from './shaders/scene.frag.glsl';
import sceneVS from './shaders/scene.vert.glsl';
import screenFS from './shaders/screen.frag.glsl';
import screenVS from './shaders/screen.vert.glsl';
import shadowFS from './shaders/shadow.frag.glsl';
import shadowVS from './shaders/shadow.vert.glsl';

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
  teapotMaterial: Material;
  planeMaterial: Material;
  camera: Camera;
  checkerTex: Texture;
} {
  const shader = Shader.fromSource(context, sceneVS, sceneFS);
  const teapotMaterial = new Material(context, shader);
  const planeMaterial = new Material(context, Shader.fromSource(context, sceneVS, sceneFS));

  const stride = 8 * 4;
  const { vertices: cubeVerts, indices: cubeIdx } = ObjLoader.parse(cubeObj);
  const buffer = new Buffer(context, cubeVerts);
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
    { indices: cubeIdx },
  );

  const checkerTex = Texture.fromData(
    context,
    checkerboard(CHECKER_SIZE),
    CHECKER_SIZE,
    CHECKER_SIZE,
  );
  teapotMaterial.bind();
  teapotMaterial.setTexture('u_texture', checkerTex, 0);
  teapotMaterial.setVec3('u_baseColor', 1, 1, 1);

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
      { loc: planeMaterial.shader.attribLocation('a_position'), size: 3, stride, offset: 0 },
      {
        loc: planeMaterial.shader.attribLocation('a_normal'),
        size: 3,
        stride,
        offset: 3 * 4,
      },
      { loc: planeMaterial.shader.attribLocation('a_uv'), size: 2, stride, offset: 6 * 4 },
    ],
    { indices: new Uint16Array([0, 2, 1, 0, 3, 2]) },
  );

  const world = new World();
  const objEntity = world.create();
  world.add(objEntity, mesh);
  world.add(objEntity, teapotMaterial);
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

  const aspect = canvas.width / canvas.height;
  return {
    world,
    pass: new RenderSystem(context, world, fb, aspect),
    teapotMaterial,
    planeMaterial,
    camera,
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
    teapotMaterial,
    planeMaterial,
    camera,
    checkerTex,
  } = createScenePass(context, canvas, fb);

  for (const mat of [teapotMaterial, planeMaterial]) {
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
  const inputSystem = new InputSystem(canvas, camera);

  function resize(): void {
    canvas.width = Math.round(canvas.clientWidth * devicePixelRatio);
    canvas.height = Math.round(canvas.clientHeight * devicePixelRatio);
    const aspect = canvas.width / canvas.height;
    fb.destroy();
    fb = Framebuffer.create(context, canvas.width, canvas.height);
    pass1.setTarget(fb);
    pass1.setAspect(aspect);
    screenMaterial.bind();
    screenMaterial.setTexture('u_screen', fb.texture, 0);
    screenMaterial.setFloat('u_aspect', aspect);
  }

  function cleanup(): void {
    window.removeEventListener('resize', resize);
    inputSystem.destroy();
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

  let lastTime = 0;
  function loop(time: number): void {
    const dt = (time - lastTime) / 1000;
    lastTime = time;
    inputSystem.update(dt);
    shadowPass.update(dt);
    pass1.update(dt);
    pass2.update(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

try {
  init();
} catch (err) {
  showError(err as Error);
}
