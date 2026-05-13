import { RenderContext } from '../renderer/RenderContext';
import { Framebuffer } from '../renderer/Framebuffer';
import { Buffer } from '../renderer/Buffer';
import { Shader } from '../renderer/Shader';
import { Texture } from '../renderer/Texture';
import { Mesh } from '../components/Mesh';
import { SkinnedMesh } from '../components/SkinnedMesh';
import { Skeleton } from '../components/Skeleton';
import { Animator } from '../components/Animator';
import type { AnimationClip } from '../components/Animator';
import { Material } from '../components/Material';
import { ParticleEmitter } from '../components/ParticleEmitter';
import type { ParticleEmitterOptions } from '../components/ParticleEmitter';
import { Mat4 } from '../math/Mat4';
import { Vec3 } from '../math/Vec3';
import type { ObjData } from '../loaders/ObjLoader';
import { GltfLoader } from '../loaders/GltfLoader';
import type {
  GltfDocument,
  GltfPrimitive,
  GltfSkin,
} from '../loaders/GltfLoader';

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

  constructor(
    context: RenderContext,
    defaultTexture: Texture,
    shadowFb: Framebuffer,
    lightSpaceMat: Mat4,
  ) {
    this.context = context;
    this.defaultTexture = defaultTexture;
    this.shadowFb = shadowFb;
    this.lightSpaceMat = lightSpaceMat;
  }

  createMesh(data: ObjData): Mesh {
    const buf = new Buffer(this.context, data.vertices);
    const mesh = new Mesh(
      this.context,
      buf,
      [
        { loc: 0, size: 3, stride: 32, offset: 0 },
        { loc: 1, size: 3, stride: 32, offset: 12 },
        { loc: 2, size: 2, stride: 32, offset: 24 },
      ],
      { indices: data.indices },
    );
    mesh.boundingSphere = AssetFactory.computeBoundingSphere(data.vertices, 8);
    return mesh;
  }

  async loadGltf(
    url: string,
  ): Promise<{ mesh: SkinnedMesh; skeleton: Skeleton; animator: Animator }> {
    return this.createGltf(await GltfLoader.load(url));
  }

  createGltf(doc: GltfDocument): {
    mesh: SkinnedMesh;
    skeleton: Skeleton;
    animator: Animator;
  } {
    return {
      mesh: this.createSkinnedMesh(doc.primitive),
      skeleton: this.createSkeleton(doc.skin),
      animator: this.createAnimator(doc.clips),
    };
  }

  createSkinnedMesh(primitive: GltfPrimitive): SkinnedMesh {
    const vertexCount = primitive.positions.length / 3;

    // Interleave pos(3) + normal(3) + uv(2) into a single float buffer (stride 32)
    const staticData = new Float32Array(vertexCount * 8);
    for (let i = 0; i < vertexCount; i++) {
      staticData.set(primitive.positions.subarray(i * 3, i * 3 + 3), i * 8);
      staticData.set(primitive.normals.subarray(i * 3, i * 3 + 3), i * 8 + 3);
      staticData.set(primitive.uvs.subarray(i * 2, i * 2 + 2), i * 8 + 6);
    }

    // Interleave joints(uvec4, 4 bytes) + weights(vec4, 16 bytes) into stride-20 buffer
    const skinAb = new ArrayBuffer(vertexCount * 20);
    const dv = new DataView(skinAb);
    for (let i = 0; i < vertexCount; i++) {
      dv.setUint8(i * 20 + 0, primitive.joints[i * 4]);
      dv.setUint8(i * 20 + 1, primitive.joints[i * 4 + 1]);
      dv.setUint8(i * 20 + 2, primitive.joints[i * 4 + 2]);
      dv.setUint8(i * 20 + 3, primitive.joints[i * 4 + 3]);
      dv.setFloat32(i * 20 + 4, primitive.weights[i * 4], true);
      dv.setFloat32(i * 20 + 8, primitive.weights[i * 4 + 1], true);
      dv.setFloat32(i * 20 + 12, primitive.weights[i * 4 + 2], true);
      dv.setFloat32(i * 20 + 16, primitive.weights[i * 4 + 3], true);
    }

    const staticBuf = new Buffer(this.context, staticData);
    const skinBuf = new Buffer(this.context, new Uint8Array(skinAb));
    const mesh = new SkinnedMesh(
      this.context,
      staticBuf,
      [
        { loc: 0, size: 3, stride: 32, offset: 0 },
        { loc: 1, size: 3, stride: 32, offset: 12 },
        { loc: 2, size: 2, stride: 32, offset: 24 },
      ],
      skinBuf,
      { indices: primitive.indices },
    );

    const bs = AssetFactory.computeBoundingSphere(staticData, 8);
    mesh.boundingSphere = { center: bs.center, radius: bs.radius * 2 };
    return mesh;
  }

  createSkeleton(skin: GltfSkin): Skeleton {
    const skeleton = new Skeleton(skin.parentIndices, skin.inverseBindMatrices);
    // Initialise local arrays to bind-pose node TRS so that joints with no
    // animation track stay in bind pose rather than collapsing to origin.
    skeleton.localTranslations.set(skin.bindTranslations);
    skeleton.localRotations.set(skin.bindRotations);
    skeleton.localScales.set(skin.bindScales);
    return skeleton;
  }

  createAnimator(clips: AnimationClip[]): Animator {
    const animator = new Animator(...clips);
    if (clips.length > 0) animator.play(clips[0].name);
    return animator;
  }

  createSkinnedMaterial(opts?: MaterialOptions): Material {
    const shader = Shader.fromSource(this.context, sceneVertSrc, sceneFragSrc, [
      'USE_SKINNING',
    ]);
    const mat = new Material(this.context, shader);
    mat.setTexture('u_texture', opts?.texture ?? this.defaultTexture, 0);
    mat.setTexture('u_shadowMap', this.shadowFb.texture, 1);
    mat.bind();
    mat.setMatrix4('u_lightSpaceMatrix', this.lightSpaceMat.array);
    const col = opts?.color;
    mat.setVec3(
      'u_baseColor',
      col ? col.x : 1,
      col ? col.y : 1,
      col ? col.z : 1,
    );
    mat.setFloat('u_specular', opts?.specular ?? 0.3);
    mat.setFloat('u_receiveShadows', opts?.receiveShadows === false ? 0 : 1);
    return mat;
  }

  private static computeBoundingSphere(
    vertices: Float32Array,
    stride: number,
  ): { center: Vec3; radius: number } {
    const n = vertices.length / stride;
    let cx = 0,
      cy = 0,
      cz = 0;
    for (let i = 0; i < n; i++) {
      cx += vertices[i * stride];
      cy += vertices[i * stride + 1];
      cz += vertices[i * stride + 2];
    }
    cx /= n;
    cy /= n;
    cz /= n;
    let r = 0;
    for (let i = 0; i < n; i++) {
      const dx = vertices[i * stride] - cx;
      const dy = vertices[i * stride + 1] - cy;
      const dz = vertices[i * stride + 2] - cz;
      r = Math.max(r, Math.sqrt(dx * dx + dy * dy + dz * dz));
    }
    return { center: new Vec3(cx, cy, cz), radius: r };
  }

  createMaterial(opts?: MaterialOptions): Material {
    const shader = Shader.fromSource(this.context, sceneVertSrc, sceneFragSrc);
    const mat = new Material(this.context, shader);

    mat.setTexture('u_texture', opts?.texture ?? this.defaultTexture, 0);
    mat.setTexture('u_shadowMap', this.shadowFb.texture, 1);
    mat.bind();
    mat.setMatrix4('u_lightSpaceMatrix', this.lightSpaceMat.array);
    const col = opts?.color;
    mat.setVec3(
      'u_baseColor',
      col ? col.x : 1,
      col ? col.y : 1,
      col ? col.z : 1,
    );
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
