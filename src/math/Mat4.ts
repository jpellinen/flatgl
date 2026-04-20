import { Vec3 } from './Vec3';

// Column-major Float32Array (matches WebGL convention).
// Index layout: col * 4 + row
export class Mat4 {
  private constructor(readonly array: Float32Array) {}

  static identity(): Mat4 {
    // prettier-ignore
    return new Mat4(new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]));
  }

  static ortho(
    left: number,
    right: number,
    bottom: number,
    top: number,
    near: number,
    far: number,
  ): Mat4 {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);
    // prettier-ignore
    return new Mat4(new Float32Array([
      -2 * lr,                   0,                0, 0,
             0,            -2 * bt,                0, 0,
             0,                   0,          2 * nf, 0,
      (left + right) * lr, (top + bottom) * bt, (far + near) * nf, 1,
    ]));
  }

  static perspective(
    fovY: number,
    aspect: number,
    near: number,
    far: number,
  ): Mat4 {
    const f = 1 / Math.tan(fovY / 2);
    const nf = 1 / (near - far);
    // prettier-ignore
    return new Mat4(new Float32Array([
      f / aspect, 0,  0,                    0,
      0,          f,  0,                    0,
      0,          0,  (far + near) * nf,   -1,
      0,          0,  2 * far * near * nf,  0,
    ]));
  }

  static lookAt(eye: Vec3, center: Vec3, up: Vec3): Mat4 {
    const f = center.sub(eye).normalize();
    const s = f.cross(up).normalize();
    const u = s.cross(f);
    // prettier-ignore
    return new Mat4(new Float32Array([
       s.x,          u.x,         -f.x,         0,
       s.y,          u.y,         -f.y,         0,
       s.z,          u.z,         -f.z,         0,
      -s.dot(eye),  -u.dot(eye),   f.dot(eye),  1,
    ]));
  }

  static translation(v: Vec3): Mat4 {
    // prettier-ignore
    return new Mat4(new Float32Array([
      1,   0,   0,   0,
      0,   1,   0,   0,
      0,   0,   1,   0,
      v.x, v.y, v.z, 1,
    ]));
  }

  static rotationX(r: number): Mat4 {
    const c = Math.cos(r),
      s = Math.sin(r);
    // prettier-ignore
    return new Mat4(new Float32Array([
      1,  0,  0,  0,
      0,  c,  s,  0,
      0, -s,  c,  0,
      0,  0,  0,  1,
    ]));
  }

  static rotationY(r: number): Mat4 {
    const c = Math.cos(r),
      s = Math.sin(r);
    // prettier-ignore
    return new Mat4(new Float32Array([
       c,  0, -s,  0,
       0,  1,  0,  0,
       s,  0,  c,  0,
       0,  0,  0,  1,
    ]));
  }

  static rotationZ(r: number): Mat4 {
    const c = Math.cos(r),
      s = Math.sin(r);
    // prettier-ignore
    return new Mat4(new Float32Array([
      c,  s,  0,  0,
     -s,  c,  0,  0,
      0,  0,  1,  0,
      0,  0,  0,  1,
    ]));
  }

  static scaling(v: Vec3): Mat4 {
    // prettier-ignore
    return new Mat4(new Float32Array([
      v.x, 0,   0,   0,
      0,   v.y, 0,   0,
      0,   0,   v.z, 0,
      0,   0,   0,   1,
    ]));
  }

  multiply(b: Mat4): Mat4 {
    const a = this.array;
    const bv = b.array;
    const out = new Float32Array(16);
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * bv[col * 4 + k];
        out[col * 4 + row] = sum;
      }
    }
    return new Mat4(out);
  }
}
