import { RenderContext } from '../renderer/RenderContext';
import { Framebuffer } from '../renderer/Framebuffer';
import { Buffer } from '../renderer/Buffer';
import { Shader } from '../renderer/Shader';
import { Texture } from '../renderer/Texture';
import { Mesh } from '../components/Mesh';
import { Material } from '../components/Material';
import { ParticleEmitter } from '../components/ParticleEmitter';
import type { ParticleEmitterOptions } from '../components/ParticleEmitter';
import { Mat4 } from '../math/Mat4';
import { Vec3 } from '../math/Vec3';
import type { ObjData } from '../loaders/ObjLoader';

import sceneVertSrc from '../shaders/scene.vert.glsl';
import sceneFragSrc from '../shaders/scene.frag.glsl';

export interface MaterialOptions {
  color?: Vec3;
  texture?: Texture;
  specular?: number;
  receiveShadows?: boolean;
}

export class AssetFactory {
  private context: RenderContext;
  private defaultTexture: Texture;
  private shadowFb: Framebuffer;
  private lightSpaceMat: Mat4;

  constructor(context: RenderContext, defaultTexture: Texture, shadowFb: Framebuffer, lightSpaceMat: Mat4) {
    this.context = context;
    this.defaultTexture = defaultTexture;
    this.shadowFb = shadowFb;
    this.lightSpaceMat = lightSpaceMat;
  }

  createMesh(data: ObjData): Mesh {
    const buf = new Buffer(this.context, data.vertices);
    const mesh = new Mesh(this.context, buf, [
      { loc: 0, size: 3, stride: 32, offset: 0 },
      { loc: 1, size: 3, stride: 32, offset: 12 },
      { loc: 2, size: 2, stride: 32, offset: 24 },
    ], { indices: data.indices });

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
    mat.bind();
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

  createParticleEmitter(opts?: ParticleEmitterOptions): ParticleEmitter {
    return new ParticleEmitter(this.context, this.defaultTexture, opts);
  }
}
