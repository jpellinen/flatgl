import { World } from '../core/World';
import type { System } from '../core/System';
import type { Entity } from '../core/Entity';
import { ScriptSystem } from '../systems/ScriptSystem';
import { AnimationSystem } from '../systems/AnimationSystem';
import { ShadowSystem } from '../systems/ShadowSystem';
import { RenderSystem, LightState } from '../systems/RenderSystem';
import { ParticleSystem } from '../systems/ParticleSystem';
import { RenderContext } from '../renderer/RenderContext';
import { Framebuffer } from '../renderer/Framebuffer';
import { Shader } from '../renderer/Shader';
import { Texture } from '../renderer/Texture';
import { ScreenPass } from './ScreenPass';
import type { PostProcessOptions } from './ScreenPass';
import { SkyboxPass } from './SkyboxPass';
import { AssetFactory } from './AssetFactory';
import { Camera } from './Camera';
import type { CameraOptions } from './Camera';
import { InputManager } from './InputManager';
import type { InputSnapshot } from './InputManager';
import type { ParticleEmitterOptions } from '../components/ParticleEmitter';
import { Transform } from '../components/Transform';
import { Mat4 } from '../math/Mat4';
import { Vec3 } from '../math/Vec3';

import shadowVertSrc from '../shaders/shadow.vert.glsl';
import shadowFragSrc from '../shaders/shadow.frag.glsl';

export type { CameraOptions };
export type { ParticleEmitterOptions };
export type { MaterialOptions } from './AssetFactory';
export type { PostProcessOptions, FogOptions } from './ScreenPass';

export interface LightOptions {
  direction?: Vec3;
  color?: Vec3;
  intensity?: number;
  ambient?: number;
}

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  camera?: CameraOptions;
  light?: LightOptions;
  postProcess?: PostProcessOptions;
  clearColor?: Vec3;
}

const SHADOW_MAP_SIZE = 2048;

function shadowExtentForCamera(camera: Camera): number {
  if (camera.orthographic) return camera.orthoSize * 1.5;
  const dist = camera.position.sub(camera.target).length();
  const viewRadius = dist * Math.tan(camera.fov / 2);
  return viewRadius * 3;
}

export class Engine {
  readonly world: World;
  readonly camera: Camera;
  readonly cameraEntity: Entity;
  readonly assets: AssetFactory;

  private canvas: HTMLCanvasElement;
  private context: RenderContext;
  private shadowFb: Framebuffer;
  private sceneFb: Framebuffer;
  private lightState: LightState;
  private screenPass: ScreenPass;
  private defaultTexture: Texture;
  private scriptSystem: ScriptSystem;
  private animationSystem: AnimationSystem;
  private shadowSystem: ShadowSystem;
  private renderSystem: RenderSystem;
  private particleSystem: ParticleSystem;
  private inputSystem: InputManager;
  private systems: System[] = [];
  private skyboxPass: SkyboxPass | null = null;
  private statsEl: HTMLDivElement | null = null;
  private smoothFps = 0;

  private constructor(options: EngineOptions) {
    this.canvas = options.canvas;
    this.context = RenderContext.create(options.canvas);

    this.camera = new Camera(options.camera);

    // Light
    const rawDir = options.light?.direction ?? new Vec3(1, 2, 1);
    const lightDir = rawDir.normalize();
    this.lightState = {
      direction: lightDir,
      color: options.light?.color ?? new Vec3(1.0, 0.88, 0.5),
      intensity: options.light?.intensity ?? 1.0,
      ambient: options.light?.ambient ?? 0.45,
    };

    // Light space matrix for shadow mapping
    const extent = shadowExtentForCamera(this.camera);
    const shadowFar = extent * 3;
    const up =
      Math.abs(lightDir.y) > 0.99 ? new Vec3(0, 0, 1) : new Vec3(0, 1, 0);
    const lightPos = lightDir.scale(shadowFar * 0.5);
    const lightView = Mat4.lookAt(lightPos, new Vec3(0, 0, 0), up);
    const lightProj = Mat4.ortho(
      -extent,
      extent,
      -extent,
      extent,
      0.1,
      shadowFar,
    );
    const lightSpaceMat = lightProj.multiply(lightView);

    // GPU resources
    this.shadowFb = Framebuffer.createDepthOnly(
      this.context,
      SHADOW_MAP_SIZE,
      SHADOW_MAP_SIZE,
    );
    this.sceneFb = Framebuffer.create(this.context, 1, 1);
    this.defaultTexture = Texture.fromData(
      this.context,
      new Uint8Array([255, 255, 255, 255]),
      1,
      1,
    );

    this.screenPass = new ScreenPass(this.context, options.postProcess ?? {});
    this.assets = new AssetFactory(
      this.context,
      this.defaultTexture,
      this.shadowFb,
      lightSpaceMat,
    );

    // ECS world + systems
    this.world = new World();
    this.world.onDestroy((entity) => {
      for (const child of this.world.query(Transform)) {
        if (this.world.get(child, Transform)?.parent === entity) {
          this.world.destroy(child);
        }
      }
    });
    this.cameraEntity = this.world.create();
    this.scriptSystem = new ScriptSystem(this.world);

    this.animationSystem = new AnimationSystem(this.world);

    const shadowShader = Shader.fromSource(
      this.context,
      shadowVertSrc,
      shadowFragSrc,
    );
    const skinnedShadowShader = Shader.fromSource(
      this.context,
      shadowVertSrc,
      shadowFragSrc,
      ['USE_SKINNING'],
    );
    this.shadowSystem = new ShadowSystem(
      this.context,
      this.world,
      this.shadowFb,
      shadowShader,
      lightSpaceMat,
      skinnedShadowShader,
    );
    const clearColor = options.clearColor ?? new Vec3(0.08, 0.08, 0.12);
    this.renderSystem = new RenderSystem(
      this.context,
      this.world,
      this.camera,
      this.lightState,
      this.sceneFb,
      1,
      clearColor,
    );

    this.particleSystem = new ParticleSystem(
      this.context,
      this.world,
      this.camera,
      this.sceneFb,
      this.defaultTexture,
    );
    this.inputSystem = new InputManager(options.canvas, this.camera);

    this.systems = [
      this.scriptSystem,
      this.animationSystem,
      this.shadowSystem,
      this.renderSystem,
      this.particleSystem,
    ];
  }

  static create(options: EngineOptions): Engine {
    return new Engine(options);
  }

  get input(): InputSnapshot {
    return this.inputSystem.snapshot;
  }

  setSkybox(texture: Texture): void {
    this.skyboxPass?.destroy();
    this.skyboxPass = new SkyboxPass(this.context, texture);
  }

  showBoundingSpheres(visible = true): void {
    this.renderSystem.showBoundingSpheres = visible;
  }

  showStats(visible = true): void {
    if (!visible) {
      this.statsEl?.remove();
      this.statsEl = null;
      return;
    }
    if (this.statsEl) return;
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;top:8px;left:8px;padding:6px 10px;background:rgba(0,0,0,0.55);' +
      'color:#e8e8e8;font:12px/1.6 monospace;border-radius:4px;pointer-events:none;z-index:9998';
    document.body.appendChild(el);
    this.statsEl = el;
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
        this.particleSystem.setTarget(this.sceneFb);
        oldFb.destroy();
      }

      const aspect = w / Math.max(h, 1);
      this.inputSystem.update(aspect);
      for (const s of this.systems) s.update?.(dt);
      for (const s of this.systems) s.render?.();
      this.skyboxPass?.render(this.sceneFb, this.camera, aspect);
      this.screenPass.render(
        this.sceneFb,
        w,
        h,
        this.camera.near,
        this.camera.far,
      );

      if (this.statsEl && dt > 0) {
        this.smoothFps = this.smoothFps * 0.9 + (1 / dt) * 0.1;
        const r = this.renderSystem;
        const s = this.shadowSystem;
        const p = this.particleSystem;
        this.statsEl.textContent = [
          `FPS  ${Math.round(this.smoothFps)}     MS  ${(dt * 1000).toFixed(1)}`,
          `DC   ${r.drawCalls}  (shadow ${s.drawCalls})`,
          `TRI  ${r.triangles.toLocaleString()}`,
          `VIS  ${r.visible}/${r.total}  BAT ${r.batches}`,
          `PAR  ${p.particles}`,
        ].join('\n');
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }

  destroy(): void {
    this.inputSystem.destroy();
    this.world.destroyAll();
    for (const s of this.systems) s.destroy?.();
    this.skyboxPass?.destroy();
    this.shadowFb.destroy();
    this.sceneFb.destroy();
    this.screenPass.destroy();
    this.defaultTexture.destroy();
    this.statsEl?.remove();
    this.statsEl = null;
  }
}
