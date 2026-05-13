import type { AnimationClip, AnimationPath } from '../components/Animator';

// --- Output types -------------------------------------------------------

export interface GltfPrimitive {
  positions: Float32Array; // vec3 per vertex
  normals: Float32Array; // vec3 per vertex
  uvs: Float32Array; // vec2 per vertex
  joints: Uint8Array; // uvec4 per vertex (UNSIGNED_BYTE)
  weights: Float32Array; // vec4 per vertex
  indices?: Uint16Array;
}

export interface GltfSkin {
  parentIndices: Int16Array; // -1 = root
  inverseBindMatrices: Float32Array; // jointCount * 16, column-major
  bindTranslations: Float32Array; // jointCount * 3  (bind-pose node TRS)
  bindRotations: Float32Array; // jointCount * 4
  bindScales: Float32Array; // jointCount * 3
}

export interface GltfDocument {
  primitive: GltfPrimitive;
  skin: GltfSkin;
  clips: AnimationClip[];
}

// --- Internal glTF JSON types -------------------------------------------

interface GltfAccessor {
  bufferView: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
}

interface GltfBufferView {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
}

interface GltfNode {
  mesh?: number;
  skin?: number;
  children?: number[];
  translation?: [number, number, number];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
}

// --- Helpers ------------------------------------------------------------

const COMPONENT_COUNTS: Record<string, number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};

function readFloats(
  idx: number,
  accessors: GltfAccessor[],
  bufferViews: GltfBufferView[],
  buffers: ArrayBuffer[],
): Float32Array {
  const acc = accessors[idx];
  const bv = bufferViews[acc.bufferView];
  const start = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const byteLen = acc.count * COMPONENT_COUNTS[acc.type] * 4;
  return new Float32Array(buffers[bv.buffer].slice(start, start + byteLen));
}

function readJoints(
  idx: number,
  accessors: GltfAccessor[],
  bufferViews: GltfBufferView[],
  buffers: ArrayBuffer[],
): Uint8Array {
  const acc = accessors[idx];
  const bv = bufferViews[acc.bufferView];
  const start = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const count = acc.count * 4; // always VEC4
  if (acc.componentType === 5121 /* UNSIGNED_BYTE */) {
    return new Uint8Array(buffers[bv.buffer].slice(start, start + count));
  }
  // UNSIGNED_SHORT (5123) — downcast; safe when jointCount <= 255
  const shorts = new Uint16Array(
    buffers[bv.buffer].slice(start, start + count * 2),
  );
  return Uint8Array.from(shorts);
}

function readUint16s(
  idx: number,
  accessors: GltfAccessor[],
  bufferViews: GltfBufferView[],
  buffers: ArrayBuffer[],
): Uint16Array {
  const acc = accessors[idx];
  const bv = bufferViews[acc.bufferView];
  const start = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  return new Uint16Array(
    buffers[bv.buffer].slice(start, start + acc.count * 2),
  );
}

// --- Parser -------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parse(json: any, buffers: ArrayBuffer[]): GltfDocument {
  const accessors: GltfAccessor[] = json.accessors ?? [];
  const bufferViews: GltfBufferView[] = json.bufferViews ?? [];
  const nodes: GltfNode[] = json.nodes ?? [];

  const rf = (i: number) => readFloats(i, accessors, bufferViews, buffers);
  const rj = (i: number) => readJoints(i, accessors, bufferViews, buffers);
  const ri = (i: number) => readUint16s(i, accessors, bufferViews, buffers);

  // Find the first skinned mesh node
  const meshNode = nodes.find(
    (n) => n.mesh !== undefined && n.skin !== undefined,
  );
  if (!meshNode) throw new Error('GltfLoader: no skinned mesh node found');

  // Primitive
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prim = (json.meshes[meshNode.mesh!] as any).primitives[0];
  const a = prim.attributes;
  const primitive: GltfPrimitive = {
    positions: rf(a.POSITION),
    normals: rf(a.NORMAL),
    uvs: rf(a.TEXCOORD_0),
    joints: rj(a.JOINTS_0),
    weights: rf(a.WEIGHTS_0),
    indices: prim.indices !== undefined ? ri(prim.indices) : undefined,
  };

  // Skin
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const skinDef = (json.skins as any[])[meshNode.skin!];
  const jointNodeIndices: number[] = skinDef.joints;
  const jointCount = jointNodeIndices.length;

  const nodeToJoint = new Map<number, number>();
  for (let i = 0; i < jointCount; i++) nodeToJoint.set(jointNodeIndices[i], i);

  // Build parent index array from node children lists
  const parentIndices = new Int16Array(jointCount).fill(-1);
  for (let i = 0; i < jointCount; i++) {
    for (const child of nodes[jointNodeIndices[i]].children ?? []) {
      const j = nodeToJoint.get(child);
      if (j !== undefined) parentIndices[j] = i;
    }
  }

  const inverseBindMatrices = rf(skinDef.inverseBindMatrices);

  // Bind-pose local TRS from node data (used to init Skeleton defaults)
  const bindTranslations = new Float32Array(jointCount * 3);
  const bindRotations = new Float32Array(jointCount * 4);
  const bindScales = new Float32Array(jointCount * 3);
  for (let i = 0; i < jointCount; i++) {
    const node = nodes[jointNodeIndices[i]];
    bindTranslations.set(node.translation ?? [0, 0, 0], i * 3);
    bindRotations.set(node.rotation ?? [0, 0, 0, 1], i * 4);
    bindScales.set(node.scale ?? [1, 1, 1], i * 3);
  }

  const skin: GltfSkin = {
    parentIndices,
    inverseBindMatrices,
    bindTranslations,
    bindRotations,
    bindScales,
  };

  // Animations
  const clips: AnimationClip[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const anim of (json.animations ?? []) as any[]) {
    const tracks = [];
    let duration = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const ch of anim.channels as any[]) {
      const path = ch.target.path as AnimationPath;
      if (path !== 'translation' && path !== 'rotation' && path !== 'scale')
        continue;
      const jointIndex = nodeToJoint.get(ch.target.node);
      if (jointIndex === undefined) continue;
      const sampler = anim.samplers[ch.sampler];
      const times = rf(sampler.input);
      const values = rf(sampler.output);
      duration = Math.max(duration, times[times.length - 1]);
      tracks.push({ jointIndex, path, times, values });
    }
    clips.push({ name: anim.name ?? `clip_${clips.length}`, duration, tracks });
  }

  return { primitive, skin, clips };
}

// --- Public API ---------------------------------------------------------

export class GltfLoader {
  static load(url: string): Promise<GltfDocument> {
    if (url.endsWith('.glb')) return GltfLoader.loadGlb(url);
    return GltfLoader.loadGltf(url);
  }

  static fromBuffer(source: ArrayBuffer | Uint8Array): GltfDocument {
    // Normalise Uint8Array (e.g. from esbuild binary loader) to a clean ArrayBuffer
    const ab =
      source instanceof Uint8Array
        ? (source.buffer.slice(
            source.byteOffset,
            source.byteOffset + source.byteLength,
          ) as ArrayBuffer)
        : source;
    const dv = new DataView(ab);
    if (dv.getUint32(0, true) !== 0x46546c67)
      throw new Error('GltfLoader: not a GLB file');
    const jsonLen = dv.getUint32(12, true);
    const jsonText = new TextDecoder().decode(new Uint8Array(ab, 20, jsonLen));
    const json = JSON.parse(jsonText);
    const buffers: ArrayBuffer[] = [];
    const binStart = 20 + jsonLen;
    if (ab.byteLength > binStart + 8) {
      const binLen = dv.getUint32(binStart, true);
      buffers.push(ab.slice(binStart + 8, binStart + 8 + binLen));
    }
    return parse(json, buffers);
  }

  private static async loadGlb(url: string): Promise<GltfDocument> {
    return GltfLoader.fromBuffer(await fetch(url).then((r) => r.arrayBuffer()));
  }

  private static async loadGltf(url: string): Promise<GltfDocument> {
    const json = await fetch(url).then((r) => r.json());
    const base = url.slice(0, url.lastIndexOf('/') + 1);
    const buffers: ArrayBuffer[] = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (json.buffers ?? []).map((b: any) =>
        fetch(base + b.uri).then((r) => r.arrayBuffer()),
      ),
    );
    return parse(json, buffers);
  }
}
