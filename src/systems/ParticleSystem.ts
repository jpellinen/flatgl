import { RenderContext } from '../renderer/RenderContext';
import { Framebuffer } from '../renderer/Framebuffer';
import { Buffer, BufferUsage } from '../renderer/Buffer';
import { Shader } from '../renderer/Shader';
import { Texture } from '../renderer/Texture';
import { Camera } from '../engine/Camera';
import { ParticleEmitter } from '../components/ParticleEmitter';
import { Transform, getWorldMatrix } from '../components/Transform';
import { World } from '../core/World';
import { System } from '../core/System';
import { Mat4 } from '../math/Mat4';
import { Vec3 } from '../math/Vec3';

import particleVertSrc from '../shaders/particle.vert.glsl';
import particleFragSrc from '../shaders/particle.frag.glsl';

// pos(3) + size(1) + color(3) + alpha(1) + rotation(1) = 9 floats = 36 bytes
const INST_STRIDE = 9;
const INST_BYTES = INST_STRIDE * 4;

interface GpuState {
  vao: WebGLVertexArrayObject;
  quadVbo: Buffer;
  instanceVbo: Buffer;
  instanceData: Float32Array;
  texture: Texture;
}

export class ParticleSystem implements System {
  particles = 0;

  private context: RenderContext;
  private world: World;
  private camera: Camera;
  private target: Framebuffer;
  private defaultTexture: Texture;
  private shader: Shader;
  private gpuStates = new Map<ParticleEmitter, GpuState>();
  private view: Mat4 = Mat4.identity();
  private proj: Mat4 = Mat4.identity();
  private viewLoc: WebGLUniformLocation | null = null;
  private projLoc: WebGLUniformLocation | null = null;
  private texLoc: WebGLUniformLocation | null = null;

  constructor(
    context: RenderContext,
    world: World,
    camera: Camera,
    target: Framebuffer,
    defaultTexture: Texture,
  ) {
    this.context = context;
    this.world = world;
    this.camera = camera;
    this.target = target;
    this.defaultTexture = defaultTexture;
    this.shader = Shader.fromSource(context, particleVertSrc, particleFragSrc);
    this.viewLoc = this.shader.uniformLocation('u_view');
    this.projLoc = this.shader.uniformLocation('u_projection');
    this.texLoc = this.shader.uniformLocation('u_texture');
  }

  setTarget(fb: Framebuffer): void {
    this.target = fb;
  }

  private initGpu(emitter: ParticleEmitter): GpuState {
    const { gl } = this.context;

    const quadVbo = new Buffer(
      this.context,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]),
      BufferUsage.STATIC_DRAW,
    );
    const instanceVbo = new Buffer(
      this.context,
      new Float32Array(emitter.maxParticles * INST_STRIDE),
      BufferUsage.DYNAMIC_DRAW,
    );

    const vao = gl.createVertexArray();
    if (!vao) throw new Error('Failed to create particle VAO');

    gl.bindVertexArray(vao);
    quadVbo.bind();
    quadVbo.setAttrib(0, 2, 8, 0);
    instanceVbo.bind();
    instanceVbo.setInstanceAttrib(1, 3, INST_BYTES, 0); // a_inst_pos
    instanceVbo.setInstanceAttrib(2, 1, INST_BYTES, 12); // a_inst_size
    instanceVbo.setInstanceAttrib(3, 3, INST_BYTES, 16); // a_inst_color
    instanceVbo.setInstanceAttrib(4, 1, INST_BYTES, 28); // a_inst_alpha
    instanceVbo.setInstanceAttrib(5, 1, INST_BYTES, 32); // a_inst_rotation
    gl.bindVertexArray(null);

    return {
      vao,
      quadVbo,
      instanceVbo,
      instanceData: new Float32Array(emitter.maxParticles * INST_STRIDE),
      texture: emitter.texture ?? this.defaultTexture,
    };
  }

  private destroyGpu(state: GpuState): void {
    this.context.gl.deleteVertexArray(state.vao);
    state.quadVbo.destroy();
    state.instanceVbo.destroy();
  }

  update(dt: number): void {
    const entities = this.world.query(ParticleEmitter, Transform);

    // Runs before the early return so GPU objects are freed the same tick the emitter is removed.
    if (this.gpuStates.size > 0) {
      const live = new Set(
        entities.map((e) => this.world.get(e, ParticleEmitter)!),
      );
      for (const [emitter, state] of this.gpuStates) {
        if (!live.has(emitter)) {
          this.destroyGpu(state);
          this.gpuStates.delete(emitter);
        }
      }
    }

    if (entities.length === 0) return;

    const { gl } = this.context;
    this.view = this.camera.viewMatrix();
    const aspect = gl.drawingBufferWidth / Math.max(gl.drawingBufferHeight, 1);
    this.proj = this.camera.projectionMatrix(aspect);

    let particles = 0;
    for (const entity of entities) {
      const emitter = this.world.get(entity, ParticleEmitter)!;
      const m = getWorldMatrix(entity, this.world).array;
      emitter.simulate(dt, new Vec3(m[12], m[13], m[14]));
      particles += emitter.liveCount;
    }
    this.particles = particles;
  }

  render(): void {
    const entities = this.world.query(ParticleEmitter, Transform);
    if (entities.length === 0) return;

    const { gl } = this.context;

    this.target.bind();
    gl.enable(gl.BLEND);
    gl.depthMask(false);

    this.shader.use();
    if (this.viewLoc) gl.uniformMatrix4fv(this.viewLoc, false, this.view.array);
    if (this.projLoc) gl.uniformMatrix4fv(this.projLoc, false, this.proj.array);
    if (this.texLoc) gl.uniform1i(this.texLoc, 0);

    for (const entity of entities) {
      const emitter = this.world.get(entity, ParticleEmitter)!;
      if (emitter.liveCount === 0) continue;

      let gpu = this.gpuStates.get(emitter);
      if (!gpu) {
        gpu = this.initGpu(emitter);
        this.gpuStates.set(emitter, gpu);
      }

      if (emitter.blend === 'additive') {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      } else {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }

      const { instanceData } = gpu;
      for (let i = 0; i < emitter.liveCount; i++) {
        const t = 1 - emitter.lifetimes[i] / emitter.maxLifetimes[i];
        const size = emitter.size + (emitter.sizeEnd - emitter.size) * t;
        const alpha = 1 - t;
        const r = emitter.color.x + (emitter.colorEnd.x - emitter.color.x) * t;
        const g = emitter.color.y + (emitter.colorEnd.y - emitter.color.y) * t;
        const b = emitter.color.z + (emitter.colorEnd.z - emitter.color.z) * t;

        const base = i * INST_STRIDE;
        const pi = i * 3;
        instanceData[base] = emitter.positions[pi];
        instanceData[base + 1] = emitter.positions[pi + 1];
        instanceData[base + 2] = emitter.positions[pi + 2];
        instanceData[base + 3] = size;
        instanceData[base + 4] = r;
        instanceData[base + 5] = g;
        instanceData[base + 6] = b;
        instanceData[base + 7] = alpha;
        instanceData[base + 8] = emitter.rotations[i];
      }

      gpu.instanceVbo.bind();
      gl.bufferSubData(
        gl.ARRAY_BUFFER,
        0,
        instanceData.subarray(0, emitter.liveCount * INST_STRIDE),
      );

      gpu.texture.bind(0);
      gl.bindVertexArray(gpu.vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, emitter.liveCount);
      gl.bindVertexArray(null);
    }

    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  destroy(): void {
    for (const state of this.gpuStates.values()) {
      this.destroyGpu(state);
    }
    this.gpuStates.clear();
    this.shader.destroy();
  }
}
