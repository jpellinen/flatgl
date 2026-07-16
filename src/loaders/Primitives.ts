import type { ObjData } from './ObjLoader';

// Face = outward normal + two in-plane axes with u × v = normal,
// so triangles (0,1,2)/(0,2,3) wind CCW seen from outside.
type Face = { n: number[]; u: number[]; v: number[] };

const CUBE_FACES: Face[] = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
];

export class Primitives {
  /** Axis-aligned cube centred at the origin; `size` is the edge length. Flat normals, per-face 0–1 UVs. */
  static cube(size = 1): ObjData {
    const h = size / 2;
    const vertexData: number[] = [];
    const indexData: number[] = [];

    for (const { n, u, v } of CUBE_FACES) {
      const base = vertexData.length / 8;
      // Corners: (-u,-v), (+u,-v), (+u,+v), (-u,+v) around the face centre
      const corners = [
        [-1, -1, 0, 0],
        [1, -1, 1, 0],
        [1, 1, 1, 1],
        [-1, 1, 0, 1],
      ];
      for (const [su, sv, tu, tv] of corners) {
        vertexData.push(
          n[0] * h + u[0] * su * h + v[0] * sv * h,
          n[1] * h + u[1] * su * h + v[1] * sv * h,
          n[2] * h + u[2] * su * h + v[2] * sv * h,
          n[0],
          n[1],
          n[2],
          tu,
          tv,
        );
      }
      indexData.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }

    return {
      vertices: new Float32Array(vertexData),
      indices: new Uint16Array(indexData),
    };
  }

  /** Flat quad on the XZ plane at Y=0 facing +Y, centred at the origin. */
  static plane(width = 1, depth = 1): ObjData {
    const w = width / 2;
    const d = depth / 2;
    // CCW seen from above (+Y)
    return {
      vertices: new Float32Array([
        -w,
        0,
        d,
        0,
        1,
        0,
        0,
        0,
        w,
        0,
        d,
        0,
        1,
        0,
        1,
        0,
        w,
        0,
        -d,
        0,
        1,
        0,
        1,
        1,
        -w,
        0,
        -d,
        0,
        1,
        0,
        0,
        1,
      ]),
      indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
    };
  }

  /** UV sphere centred at the origin. Smooth normals, equirectangular UVs. `segments` is clamped to [3, 254]. */
  static sphere(radius = 0.5, segments = 24): ObjData {
    // (s+1)^2 vertices must stay under the Uint16 index limit
    const s = Math.max(3, Math.min(254, Math.floor(segments)));
    const vertexData: number[] = [];
    const indexData: number[] = [];

    for (let lat = 0; lat <= s; lat++) {
      const theta = (lat * Math.PI) / s;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);
      for (let lon = 0; lon <= s; lon++) {
        const phi = (lon * 2 * Math.PI) / s;
        const nx = sinT * Math.cos(phi);
        const ny = cosT;
        const nz = sinT * Math.sin(phi);
        vertexData.push(
          nx * radius,
          ny * radius,
          nz * radius,
          nx,
          ny,
          nz,
          lon / s,
          1 - lat / s,
        );
      }
    }

    for (let lat = 0; lat < s; lat++) {
      for (let lon = 0; lon < s; lon++) {
        const a = lat * (s + 1) + lon;
        const b = a + s + 1;
        // Skip the degenerate triangle at each pole
        if (lat > 0) indexData.push(a, a + 1, b);
        if (lat < s - 1) indexData.push(b, a + 1, b + 1);
      }
    }

    return {
      vertices: new Float32Array(vertexData),
      indices: new Uint16Array(indexData),
    };
  }
}
