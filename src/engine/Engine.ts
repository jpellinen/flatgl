import { World } from '../core/World';
import type { Entity } from '../core/Entity';
import { ScriptSystem } from '../systems/ScriptSystem';
import { ShadowSystem } from '../systems/ShadowSystem';
import { RenderSystem, LightState } from '../systems/RenderSystem';
import { RenderContext } from '../renderer/RenderContext';
import { Framebuffer } from '../renderer/Framebuffer';
import { Buffer } from '../renderer/Buffer';
import { Shader } from '../renderer/Shader';
import { Texture } from '../renderer/Texture';
import { Mesh } from '../components/Mesh';
import { Material } from '../components/Material';
import { TopDownCamera } from './TopDownCamera';
import type { TopDownCameraOptions } from './TopDownCamera';
import { EngineInputSystem } from './InputSystem';
import type { InputSnapshot } from './InputSystem';
import { Mat4 } from '../math/Mat4';
import { Vec3 } from '../math/Vec3';
import type { ObjData } from '../loaders/ObjLoader';

import sceneVertSrc from '../shaders/scene.vert.glsl';
import sceneFragSrc from '../shaders/scene.frag.glsl';
import shadowVertSrc from '../shaders/shadow.vert.glsl';
import shadowFragSrc from '../shaders/shadow.frag.glsl';
import screenVertSrc from '../shaders/screen.vert.glsl';
import screenFragSrc from '../shaders/screen.frag.glsl';

export type { TopDownCameraOptions };

export interface LightOptions {
  direction?: Vec3;
  color?: Vec3;
  intensity?: number;
  ambient?: number;
}

export interface PostProcessOptions {
  fxaa?: boolean;
  contrast?: number;
  saturation?: number;
}

export interface MaterialOptions {
  color?: Vec3;
  texture?: Texture;
  specular?: number;
  receiveShadows?: boolean;
}

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  camera?: TopDownCameraOptions;
  light?: LightOptions;
  postProcess?: PostProcessOptions;
}

const SHADOW_MAP_SIZE = 2048;

function shadowExtentForCamera(camera: TopDownCamera): number {
  if (camera.orthographic) return camera.orthoSize * 1.5;
  const dist = camera.height / Math.sin(camera.pitch);
  const viewRadius = dist * Math.tan(camera.fov / 2);
  const zOffset = camera.height / Math.tan(camera.pitch);
  return (zOffset + viewRadius) * 1.5;
}

export class Engine {
  readonly world: World;
  readonly camera: TopDownCamera;

  private canvas: HTMLCanvasElement;
  private context: RenderContext;
  private shadowFb: Framebuffer;
  private sceneFb: Framebuffer;
  private lightSpaceMat: Mat4;
  private lightState: LightState;
  private postProcessOpts: PostProcessOptions;
  private screenShader: Shader;
  private screenQuad: Mesh;
  private defaultTexture: Texture;
  private scriptSystem: ScriptSystem;
  private shadowSystem: ShadowSystem;
  private renderSystem: RenderSystem;
  private inputSystem: EngineInputSystem;

  private constructor(options: EngineOptions) {
    this.canvas = options.canvas;
    this.context = RenderContext.create(options.canvas);

    this.camera = new TopDownCamera(options.camera);
    this.postProcessOpts = options.postProcess ?? {};

    // Light
    const rawDir = options.light?.direction ?? new Vec3(1, 2, 1);
    const lightDir = rawDir.normalize();
    this.lightState = {
      direction: lightDir,
      color: options.light?.color ?? new Vec3(1, 1, 1),
      intensity: options.light?.intensity ?? 0.8,
      ambient: options.light?.ambient ?? 0.25,
    };

    // Light space matrix for shadow mapping
    const extent = shadowExtentForCamera(this.camera);
    const shadowFar = extent * 3;
    const up = Math.abs(lightDir.y) > 0.99 ? new Vec3(0, 0, 1) : new Vec3(0, 1, 0);
    const lightPos = lightDir.scale(shadowFar * 0.5);
    const lightView = Mat4.lookAt(lightPos, new Vec3(0, 0, 0), up);
    const lightProj = Mat4.ortho(-extent, extent, -extent, extent, 0.1, shadowFar);
    this.lightSpaceMat = lightProj.multiply(lightView);

    // GPU resources
    this.shadowFb = Framebuffer.createDepthOnly(this.context, SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
    this.sceneFb = Framebuffer.create(this.context, 1, 1);
    this.defaultTexture = Texture.fromData(this.context, new Uint8Array([255, 255, 255, 255]), 1, 1);

    // Screen shader + fullscreen quad
    this.screenShader = Shader.fromSource(this.context, screenVertSrc, screenFragSrc);
    const quadData = new Float32Array([
      -1, -1, 0, 0,   1, -1, 1, 0,   -1, 1, 0, 1,
       1, -1, 1, 0,   1,  1, 1, 1,   -1, 1, 0, 1,
    ]);
    const quadBuf = new Buffer(this.context, quadData);
    const posLoc = this.screenShader.attribLocation('a_position');
    const uvLoc  = this.screenShader.attribLocation('a_uv');
    this.screenQuad = new Mesh(this.context, quadBuf, [
      { loc: posLoc, size: 2, stride: 16, offset: 0 },
      { loc: uvLoc,  size: 2, stride: 16, offset: 8 },
    ], { vertexCount: 6 });

    // ECS world + systems
    this.world = new World();
    this.scriptSystem = new ScriptSystem(this.world);

    const shadowShader = Shader.fromSource(this.context, shadowVertSrc, shadowFragSrc);
    this.shadowSystem = new ShadowSystem(this.context, this.world, this.shadowFb, shadowShader, this.lightSpaceMat);
    this.renderSystem = new RenderSystem(this.context, this.world, this.camera, this.lightState, this.sceneFb, 1);

    this.inputSystem = new EngineInputSystem(options.canvas, this.camera);
  }

  static create(options: EngineOptions): Engine {
    return new Engine(options);
  }

  get input(): InputSnapshot {
    return this.inputSystem.snapshot;
  }

  start(): () => void {
    let rafId = 0;
    let lastTime = 0;
    let lastW = 0;
    let lastH = 0;

    const tick = (time: number) => {
      rafId = requestAnimationFrame(tick);
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const dpr = window.devicePixelRatio ?? 1;
      const w = Math.floor(this.canvas.clientWidth * dpr);
      const h = Math.floor(this.canvas.clientHeight * dpr);

      if (w !== lastW || h !== lastH) {
        this.canvas.width = w;
        this.canvas.height = h;
        lastW = w;
        lastH = h;
        const oldFb = this.sceneFb;
        this.sceneFb = Framebuffer.create(this.context, w, h);
        this.renderSystem.setTarget(this.sceneFb);
        this.renderSystem.setAspect(w / h);
        oldFb.destroy();
      }

      const aspect = w / Math.max(h, 1);
      this.inputSystem.update(aspect);
      this.scriptSystem.update(dt);
      this.shadowSystem.update();
      this.renderSystem.update();
      this.drawScreenPass(w, h);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }

  private drawScreenPass(width: number, height: number): void {
    const { gl } = this.context;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.screenShader.use();
    this.sceneFb.texture.bind(0);

    const u = (name: string) => this.screenShader.uniformLocation(name);
    const s = u('u_screen');     if (s) gl.uniform1i(s, 0);
    const t = u('u_texelSize');  if (t) gl.uniform2f(t, 1 / width, 1 / height);
    const f = u('u_fxaa');       if (f) gl.uniform1f(f, this.postProcessOpts.fxaa === false ? 0.0 : 1.0);
    const c = u('u_contrast');   if (c) gl.uniform1f(c, this.postProcessOpts.contrast ?? 1.0);
    const a = u('u_saturation'); if (a) gl.uniform1f(a, this.postProcessOpts.saturation ?? 1.0);

    this.screenQuad.draw();
    gl.enable(gl.DEPTH_TEST);
  }

  createMesh(data: ObjData): Mesh {
    const buf = new Buffer(this.context, data.vertices);
    const mesh = new Mesh(this.context, buf, [
      { loc: 0, size: 3, stride: 32, offset: 0 },
      { loc: 1, size: 3, stride: 32, offset: 12 },
      { loc: 2, size: 2, stride: 32, offset: 24 },
    ], { indices: data.indices });

    // Compute bounding sphere from vertex positions
    const n = data.vertices.length / 8;
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < n; i++) {
      cx += data.vertices[i * 8];
      cy += data.vertices[i * 8 + 1];
      cz += data.vertices[i * 8 + 2];
    }
    cx /= n; cy /= n; cz /= n;
    let r = 0;
    for (let i = 0; i < n; i++) {
      const dx = data.vertices[i * 8]     - cx;
      const dy = data.vertices[i * 8 + 1] - cy;
      const dz = data.vertices[i * 8 + 2] - cz;
      r = Math.max(r, Math.sqrt(dx * dx + dy * dy + dz * dz));
    }
    mesh.boundingSphere = { center: new Vec3(cx, cy, cz), radius: r };

    return mesh;
  }

  createMaterial(opts?: MaterialOptions): Material {
    const shader = Shader.fromSource(this.context, sceneVertSrc, sceneFragSrc);
    const mat = new Material(this.context, shader);

    mat.setTexture('u_texture', opts?.texture ?? this.defaultTexture, 0);
    mat.setTexture('u_shadowMap', this.shadowFb.texture, 1);
    mat.setMatrix4('u_lightSpaceMatrix', this.lightSpaceMat.array);
    const col = opts?.color;
    mat.setVec3('u_baseColor', col ? col.x : 1, col ? col.y : 1, col ? col.z : 1);
    mat.setFloat('u_specular', opts?.specular ?? 0.3);
    mat.setFloat('u_receiveShadows', opts?.receiveShadows === false ? 0 : 1);

    return mat;
  }

  createTexture(data: Uint8Array, width: number, height: number): Texture {
    return Texture.fromData(this.context, data, width, height);
  }

  loadTexture(url: string): Promise<Texture> {
    return Texture.load(this.context, url);
  }

  destroyEntity(entity: Entity): void {
    this.scriptSystem.destroyEntity(entity);
  }

  destroy(): void {
    this.inputSystem.destroy();
    this.scriptSystem.destroyAll();
    this.shadowSystem.destroy();
    this.world.destroyAll();
    this.shadowFb.destroy();
    this.sceneFb.destroy();
    this.screenQuad.destroy();
    this.screenShader.destroy();
    this.defaultTexture.destroy();
  }
}
