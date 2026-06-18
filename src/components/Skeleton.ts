import { Component } from '@/core/Component';

const IDENTITY_16 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] as const;

export class Skeleton extends Component {
  readonly jointCount: number;
  readonly parentIndices: Int16Array;
  readonly inverseBindMatrices: Float32Array;

  readonly localTranslations: Float32Array;
  readonly localRotations: Float32Array;
  readonly localScales: Float32Array;

  readonly jointMatrices: Float32Array;
  /** Flat Float32Array of size jointCount * 16, column-major world matrices. */
  readonly worldMats: Float32Array;
  /** Joint indices in topological order (parents before children). */
  readonly topoOrder: number[];

  constructor(parentIndices: Int16Array, inverseBindMatrices: Float32Array) {
    super();
    this.jointCount = parentIndices.length;
    this.parentIndices = parentIndices;
    this.inverseBindMatrices = inverseBindMatrices;

    this.localTranslations = new Float32Array(this.jointCount * 3);
    this.localRotations = new Float32Array(this.jointCount * 4);
    this.localScales = new Float32Array(this.jointCount * 3);

    // pre-fill rotations with identity quaternions (0,0,0,1)
    for (let i = 0; i < this.jointCount; i++) {
      this.localRotations[i * 4 + 3] = 1;
    }

    // pre-fill scales with 1
    for (let i = 0; i < this.jointCount; i++) {
      this.localScales[i * 3] = 1;
      this.localScales[i * 3 + 1] = 1;
      this.localScales[i * 3 + 2] = 1;
    }

    // pre-fill joint matrices with identity (64 slots, unused stay identity)
    this.jointMatrices = new Float32Array(64 * 16);
    for (let i = 0; i < 64; i++) {
      for (let j = 0; j < 16; j++) {
        this.jointMatrices[i * 16 + j] = IDENTITY_16[j];
      }
    }

    // Flat world matrices, initialized to identity
    this.worldMats = new Float32Array(this.jointCount * 16);
    for (let i = 0; i < this.jointCount; i++) {
      const o = i * 16;
      this.worldMats[o] = 1;
      this.worldMats[o + 5] = 1;
      this.worldMats[o + 10] = 1;
      this.worldMats[o + 15] = 1;
    }

    // Topological sort: parents before children (Kahn's algorithm on a forest)
    const children: number[][] = Array.from(
      { length: this.jointCount },
      () => [],
    );
    for (let i = 0; i < this.jointCount; i++) {
      const p = this.parentIndices[i];
      if (p >= 0) children[p].push(i);
    }
    const topoOrder: number[] = [];
    let head = 0;
    for (let i = 0; i < this.jointCount; i++) {
      if (this.parentIndices[i] < 0) topoOrder.push(i);
    }
    while (head < topoOrder.length) {
      const j = topoOrder[head++];
      for (const child of children[j]) topoOrder.push(child);
    }
    this.topoOrder = topoOrder;
  }
}
