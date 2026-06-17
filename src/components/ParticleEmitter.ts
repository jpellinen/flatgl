import { Component } from '@/core/Component';
import { Texture } from '../renderer/Texture';
import { Vec3 } from '../math/Vec3';

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

export class ParticleEmitter extends Component {
  active = true;

  readonly maxParticles: number;
  readonly rate: number;
  readonly lifetime: number;
  readonly speed: number;
  readonly spread: number;
  readonly gravity: number;
  readonly size: number;
  readonly sizeEnd: number;
  readonly color: Vec3;
  readonly colorEnd: Vec3;
  readonly rotationSpeed: number;
  readonly blend: 'additive' | 'alpha';
  readonly texture: Texture | null;

  readonly positions: Float32Array;
  readonly velocities: Float32Array;
  readonly lifetimes: Float32Array;
  readonly maxLifetimes: Float32Array;
  readonly rotations: Float32Array;
  readonly rotationSpeeds: Float32Array;

  private _liveCount = 0;
  private emitAccum = 0;

  get liveCount(): number {
    return this._liveCount;
  }

  constructor(opts: ParticleEmitterOptions = {}) {
    super();
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
    this.texture = opts.texture ?? null;

    this.positions = new Float32Array(this.maxParticles * 3);
    this.velocities = new Float32Array(this.maxParticles * 3);
    this.lifetimes = new Float32Array(this.maxParticles);
    this.maxLifetimes = new Float32Array(this.maxParticles);
    this.rotations = new Float32Array(this.maxParticles);
    this.rotationSpeeds = new Float32Array(this.maxParticles);
  }

  simulate(dt: number, origin: Vec3): void {
    let i = 0;
    while (i < this._liveCount) {
      this.lifetimes[i] -= dt;
      if (this.lifetimes[i] <= 0) {
        this.swapWithLast(i);
        this._liveCount--;
      } else {
        const vi = i * 3;
        this.velocities[vi + 1] += this.gravity * dt;
        this.positions[vi] += this.velocities[vi] * dt;
        this.positions[vi + 1] += this.velocities[vi + 1] * dt;
        this.positions[vi + 2] += this.velocities[vi + 2] * dt;
        this.rotations[i] += this.rotationSpeeds[i] * dt;
        i++;
      }
    }

    if (!this.active) return;

    this.emitAccum += this.rate * dt;
    while (this.emitAccum >= 1 && this._liveCount < this.maxParticles) {
      this.spawnParticle(origin);
      this.emitAccum--;
    }
    if (this.emitAccum >= 1) this.emitAccum = 0;
  }

  private spawnParticle(origin: Vec3): void {
    const i = this._liveCount;
    const life = this.lifetime * (0.8 + Math.random() * 0.4);
    this.lifetimes[i] = life;
    this.maxLifetimes[i] = life;

    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * this.spread;
    const sinPhi = Math.sin(phi);
    const speed = this.speed * (0.7 + Math.random() * 0.6);

    const pi = i * 3;
    this.positions[pi] = origin.x;
    this.positions[pi + 1] = origin.y;
    this.positions[pi + 2] = origin.z;
    this.velocities[pi] = Math.cos(theta) * sinPhi * speed;
    this.velocities[pi + 1] = Math.cos(phi) * speed;
    this.velocities[pi + 2] = Math.sin(theta) * sinPhi * speed;

    this.rotations[i] = Math.random() * Math.PI * 2;
    this.rotationSpeeds[i] = (Math.random() * 2 - 1) * this.rotationSpeed;

    this._liveCount++;
  }

  private swapWithLast(i: number): void {
    const last = this._liveCount - 1;
    if (i === last) return;

    const pi = i * 3,
      pl = last * 3;
    this.positions[pi] = this.positions[pl];
    this.positions[pi + 1] = this.positions[pl + 1];
    this.positions[pi + 2] = this.positions[pl + 2];
    this.velocities[pi] = this.velocities[pl];
    this.velocities[pi + 1] = this.velocities[pl + 1];
    this.velocities[pi + 2] = this.velocities[pl + 2];
    this.lifetimes[i] = this.lifetimes[last];
    this.maxLifetimes[i] = this.maxLifetimes[last];
    this.rotations[i] = this.rotations[last];
    this.rotationSpeeds[i] = this.rotationSpeeds[last];
  }
}
