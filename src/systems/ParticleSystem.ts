import { RenderContext } from '../renderer/RenderContext';
import { Framebuffer } from '../renderer/Framebuffer';
import { Camera } from '../engine/Camera';
import { ParticleEmitter } from '../components/ParticleEmitter';
import { Transform, getWorldMatrix } from '../components/Transform';
import { World } from '../core/World';
import { System } from '../core/System';
import { Mat4 } from '../math/Mat4';
import { Vec3 } from '../math/Vec3';

export class ParticleSystem implements System {
  private context: RenderContext;
  private world: World;
  private camera: Camera;
  private target: Framebuffer;
  private view: Mat4 = Mat4.identity();
  private proj: Mat4 = Mat4.identity();

  constructor(context: RenderContext, world: World, camera: Camera, target: Framebuffer) {
    this.context = context;
    this.world = world;
    this.camera = camera;
    this.target = target;
  }

  setTarget(fb: Framebuffer): void {
    this.target = fb;
  }

  update(dt: number): void {
    const entities = this.world.query(ParticleEmitter, Transform);
    if (entities.length === 0) return;

    const { gl } = this.context;
    this.view = this.camera.viewMatrix();
    const aspect = gl.drawingBufferWidth / Math.max(gl.drawingBufferHeight, 1);
    this.proj = this.camera.projectionMatrix(aspect);

    for (const entity of entities) {
      const emitter = this.world.get(entity, ParticleEmitter)!;
      const m = getWorldMatrix(entity, this.world).array;
      emitter.simulate(dt, new Vec3(m[12], m[13], m[14]));
    }
  }

  render(): void {
    const entities = this.world.query(ParticleEmitter, Transform);
    if (entities.length === 0) return;

    const { gl } = this.context;

    this.target.bind();
    gl.enable(gl.BLEND);
    gl.depthMask(false);

    for (const entity of entities) {
      const emitter = this.world.get(entity, ParticleEmitter)!;
      if (emitter.blend === 'additive') {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      } else {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }
      emitter.render(this.view, this.proj);
    }

    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  destroy(): void {}
}
