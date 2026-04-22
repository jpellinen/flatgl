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

  // Gribb-Hartmann frustum plane extraction from a combined VP matrix.
  // Each plane is [a,b,c,d] (normalized) where ax+by+cz+d >= 0 is inside.
  // Order: left, right, bottom, top, near, far.
  frustumPlanes(): [number, number, number, number][] {
    const m = this.array;
    // Row i of the column-major matrix: (m[i], m[4+i], m[8+i], m[12+i])
    const plane = (
      a: number, b: number, c: number, d: number,
    ): [number, number, number, number] => {
      const len = Math.sqrt(a * a + b * b + c * c);
      return [a / len, b / len, c / len, d / len];
    };
    return [
      plane(m[0]+m[3],  m[4]+m[7],  m[8]+m[11],  m[12]+m[15]),  // left
      plane(m[3]-m[0],  m[7]-m[4],  m[11]-m[8],  m[15]-m[12]),  // right
      plane(m[1]+m[3],  m[5]+m[7],  m[9]+m[11],  m[13]+m[15]),  // bottom
      plane(m[3]-m[1],  m[7]-m[5],  m[11]-m[9],  m[15]-m[13]),  // top
      plane(m[2]+m[3],  m[6]+m[7],  m[10]+m[11], m[14]+m[15]),  // near
      plane(m[3]-m[2],  m[7]-m[6],  m[11]-m[10], m[15]-m[14]),  // far
    ];
  }

  // General 4x4 matrix inverse. Returns null if matrix is singular.
  invert(): Mat4 | null {
    const a = this.array;
    const a00 = a[0],  a01 = a[1],  a02 = a[2],  a03 = a[3];
    const a10 = a[4],  a11 = a[5],  a12 = a[6],  a13 = a[7];
    const a20 = a[8],  a21 = a[9],  a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    const b00 = a00*a11 - a01*a10, b01 = a00*a12 - a02*a10;
    const b02 = a00*a13 - a03*a10, b03 = a01*a12 - a02*a11;
    const b04 = a01*a13 - a03*a11, b05 = a02*a13 - a03*a12;
    const b06 = a20*a31 - a21*a30, b07 = a20*a32 - a22*a30;
    const b08 = a20*a33 - a23*a30, b09 = a21*a32 - a22*a31;
    const b10 = a21*a33 - a23*a31, b11 = a22*a33 - a23*a32;

    const det = b00*b11 - b01*b10 + b02*b09 + b03*b08 - b04*b07 + b05*b06;
    if (Math.abs(det) < 1e-10) return null;
    const id = 1 / det;

    // prettier-ignore
    return new Mat4(new Float32Array([
       (a11*b11 - a12*b10 + a13*b09) * id,
       (a02*b10 - a01*b11 - a03*b09) * id,
       (a31*b05 - a32*b04 + a33*b03) * id,
       (a22*b04 - a21*b05 - a23*b03) * id,
       (a12*b08 - a10*b11 - a13*b07) * id,
       (a00*b11 - a02*b08 + a03*b07) * id,
       (a32*b02 - a30*b05 - a33*b01) * id,
       (a20*b05 - a22*b02 + a23*b01) * id,
       (a10*b10 - a11*b08 + a13*b06) * id,
       (a01*b08 - a00*b10 - a03*b06) * id,
       (a30*b04 - a31*b02 + a33*b00) * id,
       (a21*b02 - a20*b04 - a23*b00) * id,
       (a11*b07 - a10*b09 - a12*b06) * id,
       (a00*b09 - a01*b07 + a02*b06) * id,
       (a31*b01 - a30*b03 - a32*b00) * id,
       (a20*b03 - a21*b01 + a22*b00) * id,
    ]));
  }
}
