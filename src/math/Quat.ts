import { Mat4 } from './Mat4';

export class Quat {
  constructor(
    readonly x: number,
    readonly y: number,
    readonly z: number,
    readonly w: number,
  ) {}

  static identity(): Quat {
    return new Quat(0, 0, 0, 1);
  }

  static fromArray(a: ArrayLike<number>, offset = 0): Quat {
    return new Quat(a[offset], a[offset + 1], a[offset + 2], a[offset + 3]);
  }

  multiply(b: Quat): Quat {
    const { x: ax, y: ay, z: az, w: aw } = this;
    const { x: bx, y: by, z: bz, w: bw } = b;
    return new Quat(
      aw * bx + ax * bw + ay * bz - az * by,
      aw * by - ax * bz + ay * bw + az * bx,
      aw * bz + ax * by - ay * bx + az * bw,
      aw * bw - ax * bx - ay * by - az * bz,
    );
  }

  slerp(b: Quat, t: number): Quat {
    let { x: bx, y: by, z: bz, w: bw } = b;
    let dot = this.x * bx + this.y * by + this.z * bz + this.w * bw;
    if (dot < 0) {
      bx = -bx;
      by = -by;
      bz = -bz;
      bw = -bw;
      dot = -dot;
    }
    if (dot > 0.9999) {
      const rx = this.x + t * (bx - this.x);
      const ry = this.y + t * (by - this.y);
      const rz = this.z + t * (bz - this.z);
      const rw = this.w + t * (bw - this.w);
      const len = Math.sqrt(rx * rx + ry * ry + rz * rz + rw * rw);
      return new Quat(rx / len, ry / len, rz / len, rw / len);
    }
    const theta = Math.acos(dot);
    const sinTheta = Math.sin(theta);
    const s0 = Math.sin((1 - t) * theta) / sinTheta;
    const s1 = Math.sin(t * theta) / sinTheta;
    return new Quat(
      s0 * this.x + s1 * bx,
      s0 * this.y + s1 * by,
      s0 * this.z + s1 * bz,
      s0 * this.w + s1 * bw,
    );
  }

  toMat4(): Mat4 {
    const { x, y, z, w } = this;
    const x2 = x + x,
      y2 = y + y,
      z2 = z + z;
    const xx = x * x2,
      xy = x * y2,
      xz = x * z2;
    const yy = y * y2,
      yz = y * z2,
      zz = z * z2;
    const wx = w * x2,
      wy = w * y2,
      wz = w * z2;
    // prettier-ignore
    return Mat4.fromArray([
      1 - (yy + zz), xy + wz,       xz - wy,       0,
      xy - wz,       1 - (xx + zz), yz + wx,       0,
      xz + wy,       yz - wx,       1 - (xx + yy), 0,
      0,             0,             0,             1,
    ]);
  }
}
