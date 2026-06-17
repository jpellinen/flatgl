import { Component } from '@/core/Component';
import { Mat4 } from '@/math/Mat4';
const IDENTITY_16 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] as const;

export class Skeleton extends Component {
  readonly jointCount: number;
  readonly parentIndices: Int16Array;
  readonly inverseBindMatrices: Float32Array;

  readonly localTranslations: Float32Array;
  readonly localRotations: Float32Array;
  readonly localScales: Float32Array;

  readonly jointMatrices: Float32Array;
  readonly worldMats: Mat4[];

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

    this.worldMats = new Array(this.jointCount);
  }
}
