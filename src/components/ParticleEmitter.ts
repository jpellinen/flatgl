import { RenderContext } from '../renderer/RenderContext';
import { Shader } from '../renderer/Shader';
import { Texture } from '../renderer/Texture';
import { Buffer } from '../renderer/Buffer';
import { Mat4 } from '../math/Mat4';
import { Vec3 } from '../math/Vec3';

import particleVertSrc from '../shaders/particle.vert.glsl';
import particleFragSrc from '../shaders/particle.frag.glsl';

export interface ParticleEmitterOptions {
  maxParticles?: number;
  rate?: number;
  lifetime?: number;
  speed?: number;
  spread?: number;
  gravity?: number;
  size?: number;
  sizeEnd?: number;
  color?: Vec3;
  colorEnd?: Vec3;
  texture?: Texture;
  blend?: 'additive' | 'alpha';
  rotationSpeed?: number;
}

// pos(3) + size(1) + color(3) + alpha(1) + rotation(1) = 9 floats = 36 bytes
const INST_STRIDE = 9;
const INST_BYTES  = INST_STRIDE * 4;

export class ParticleEmitter {
  active: boolean = true;

  private gl: WebGL2RenderingContext;
  private shader: Shader;
  private texture: Texture;
  private vao: WebGLVertexArrayObject;
  private quadVbo: Buffer;
  private instanceVbo: Buffer;

  private maxParticles: number;
  private rate: number;
  private lifetime: number;
  private speed: number;
  private spread: number;
  private gravity: number;
  private size: number;
  private sizeEnd: number;
  private color: Vec3;
  private colorEnd: Vec3;
  private rotationSpeed: number;
  readonly blend: 'additive' | 'alpha';

  private positions: Float32Array;
  private velocities: Float32Array;
  private lifetimes: Float32Array;
  private maxLifetimes: Float32Array;
  private rotations: Float32Array;
  private rotationSpeeds: Float32Array;
  private instanceData: Float32Array;
  private liveCount = 0;
  private emitAccum = 0;

  constructor(context: RenderContext, defaultTexture: Texture, opts: ParticleEmitterOptions = {}) {
    this.gl = context.gl;
    this.shader = Shader.fromSource(context, particleVertSrc, particleFragSrc);
    this.texture = opts.texture ?? defaultTexture;

    this.maxParticles = opts.maxParticles ?? 500;
    this.rate = opts.rate ?? 30;
    this.lifetime = opts.lifetime ?? 1.5;
    this.speed = opts.speed ?? 2.0;
    this.spread = opts.spread ?? 0.5;
    this.gravity = opts.gravity ?? -3;
    this.size = opts.size ?? 0.15;
    this.sizeEnd = opts.sizeEnd ?? 0.0;
    this.color = opts.color ?? new Vec3(1, 0.5, 0.1);
    this.colorEnd = opts.colorEnd ?? this.color;
    this.rotationSpeed = opts.rotationSpeed ?? 2.0;
    this.blend = opts.blend ?? 'additive';

    this.positions = new Float32Array(this.maxParticles * 3);
    this.velocities = new Float32Array(this.maxParticles * 3);
    this.lifetimes = new Float32Array(this.maxParticles);
    this.maxLifetimes = new Float32Array(this.maxParticles);
    this.rotations = new Float32Array(this.maxParticles);
    this.rotationSpeeds = new Float32Array(this.maxParticles);
    this.instanceData = new Float32Array(this.maxParticles * INST_STRIDE);

    // Unit quad: 6 verts, 2 floats each (x, y corner coords)
    const quadData = new Float32Array([
      -1, -1,   1, -1,  -1,  1,
       1, -1,   1,  1,  -1,  1,
    ]);
    this.quadVbo = new Buffer(context, quadData, this.gl.STATIC_DRAW);

    // Instance buffer: preallocated, updated every frame
    const emptyInst = new Float32Array(this.maxParticles * INST_STRIDE);
    this.instanceVbo = new Buffer(context, emptyInst, this.gl.DYNAMIC_DRAW);

    // VAO setup
    const vao = this.gl.createVertexArray();
    if (!vao) throw new Error('Failed to create particle VAO');
    this.vao = vao;
    this.gl.bindVertexArray(this.vao);

    this.quadVbo.bind();
    this.quadVbo.setAttrib(0, 2, 8, 0);

    this.instanceVbo.bind();
    this.instanceVbo.setInstanceAttrib(1, 3, INST_BYTES, 0);   // a_inst_pos
    this.instanceVbo.setInstanceAttrib(2, 1, INST_BYTES, 12);  // a_inst_size
    this.instanceVbo.setInstanceAttrib(3, 3, INST_BYTES, 16);  // a_inst_color
    this.instanceVbo.setInstanceAttrib(4, 1, INST_BYTES, 28);  // a_inst_alpha
    this.instanceVbo.setInstanceAttrib(5, 1, INST_BYTES, 32);  // a_inst_rotation

    this.gl.bindVertexArray(null);
  }

  simulate(dt: number, origin: Vec3): void {
    // Update live particles (swap-delete)
    let i = 0;
    while (i < this.liveCount) {
      this.lifetimes[i] -= dt;
      if (this.lifetimes[i] <= 0) {
        this.swapWithLast(i);
        this.liveCount--;
      } else {
        const vi = i * 3;
        this.velocities[vi + 1] += this.gravity * dt;
        this.positions[vi]     += this.velocities[vi]     * dt;
        this.positions[vi + 1] += this.velocities[vi + 1] * dt;
        this.positions[vi + 2] += this.velocities[vi + 2] * dt;
        this.rotations[i] += this.rotationSpeeds[i] * dt;
        i++;
      }
    }

    if (!this.active) return;

    // Emit new particles
    this.emitAccum += this.rate * dt;
    while (this.emitAccum >= 1 && this.liveCount < this.maxParticles) {
      this.spawnParticle(origin);
      this.emitAccum--;
    }
    if (this.emitAccum >= 1) this.emitAccum = 0;
  }

  render(view: Mat4, proj: Mat4): void {
    if (this.liveCount === 0) return;

    // Build instance data for live particles
    for (let i = 0; i < this.liveCount; i++) {
      const t = 1 - this.lifetimes[i] / this.maxLifetimes[i]; // 0=new, 1=dying
      const size = this.size + (this.sizeEnd - this.size) * t;
      const alpha = 1 - t;
      const r = this.color.x + (this.colorEnd.x - this.color.x) * t;
      const g = this.color.y + (this.colorEnd.y - this.color.y) * t;
      const b = this.color.z + (this.colorEnd.z - this.color.z) * t;

      const base = i * INST_STRIDE;
      const pi = i * 3;
      this.instanceData[base]     = this.positions[pi];
      this.instanceData[base + 1] = this.positions[pi + 1];
      this.instanceData[base + 2] = this.positions[pi + 2];
      this.instanceData[base + 3] = size;
      this.instanceData[base + 4] = r;
      this.instanceData[base + 5] = g;
      this.instanceData[base + 6] = b;
      this.instanceData[base + 7] = alpha;
      this.instanceData[base + 8] = this.rotations[i];
    }

    this.instanceVbo.bind();
    this.gl.bufferSubData(
      this.gl.ARRAY_BUFFER,
      0,
      this.instanceData.subarray(0, this.liveCount * INST_STRIDE),
    );

    this.shader.use();

    const viewLoc = this.shader.uniformLocation('u_view');
    const projLoc = this.shader.uniformLocation('u_projection');
    const texLoc  = this.shader.uniformLocation('u_texture');
    if (viewLoc) this.gl.uniformMatrix4fv(viewLoc, false, view.array);
    if (projLoc) this.gl.uniformMatrix4fv(projLoc, false, proj.array);
    if (texLoc)  this.gl.uniform1i(texLoc, 0);

    this.texture.bind(0);

    this.gl.bindVertexArray(this.vao);
    this.gl.drawArraysInstanced(this.gl.TRIANGLES, 0, 6, this.liveCount);
    this.gl.bindVertexArray(null);
  }

  destroy(): void {
    this.gl.deleteVertexArray(this.vao);
    this.quadVbo.destroy();
    this.instanceVbo.destroy();
    this.shader.destroy();
  }

  private spawnParticle(origin: Vec3): void {
    const i = this.liveCount;
    const life = this.lifetime * (0.8 + Math.random() * 0.4);
    this.lifetimes[i] = life;
    this.maxLifetimes[i] = life;

    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * this.spread;
    const sinPhi = Math.sin(phi);
    const speed = this.speed * (0.7 + Math.random() * 0.6);

    const pi = i * 3;
    this.positions[pi]     = origin.x;
    this.positions[pi + 1] = origin.y;
    this.positions[pi + 2] = origin.z;
    this.velocities[pi]     = Math.cos(theta) * sinPhi * speed;
    this.velocities[pi + 1] = Math.cos(phi) * speed;
    this.velocities[pi + 2] = Math.sin(theta) * sinPhi * speed;

    this.rotations[i] = Math.random() * Math.PI * 2;
    this.rotationSpeeds[i] = (Math.random() * 2 - 1) * this.rotationSpeed;

    this.liveCount++;
  }

  private swapWithLast(i: number): void {
    const last = this.liveCount - 1;
    if (i === last) return;

    const pi = i * 3, pl = last * 3;
    this.positions[pi]     = this.positions[pl];
    this.positions[pi + 1] = this.positions[pl + 1];
    this.positions[pi + 2] = this.positions[pl + 2];
    this.velocities[pi]     = this.velocities[pl];
    this.velocities[pi + 1] = this.velocities[pl + 1];
    this.velocities[pi + 2] = this.velocities[pl + 2];
    this.lifetimes[i] = this.lifetimes[last];
    this.maxLifetimes[i] = this.maxLifetimes[last];
    this.rotations[i] = this.rotations[last];
    this.rotationSpeeds[i] = this.rotationSpeeds[last];
  }
}
