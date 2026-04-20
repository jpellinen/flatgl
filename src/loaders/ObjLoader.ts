export interface ObjData {
  vertices: Float32Array; // interleaved pos(3) + normal(3) + uv(2), stride 32 bytes
  indices: Uint16Array;
}

export class ObjLoader {
  static parse(text: string): ObjData {
    const pos: number[] = [];
    const nrm: number[] = [];
    const tex: number[] = [];

    // Each face vertex: [posIdx, uvIdx, normIdx] (0-based; -1 = missing)
    type FaceVert = [number, number, number];
    const faces: FaceVert[][] = [];

    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const parts = line.split(/\s+/);

      if (parts[0] === 'v') {
        pos.push(+parts[1], +parts[2], +parts[3]);
      } else if (parts[0] === 'vn') {
        nrm.push(+parts[1], +parts[2], +parts[3]);
      } else if (parts[0] === 'vt') {
        tex.push(+parts[1], +parts[2]);
      } else if (parts[0] === 'f') {
        const verts: FaceVert[] = [];
        for (let i = 1; i < parts.length; i++) {
          const [ps, ts, ns] = parts[i].split('/');
          verts.push([
            ps ? +ps - 1 : 0,
            ts ? +ts - 1 : -1,
            ns ? +ns - 1 : -1,
          ]);
        }
        faces.push(verts);
      }
    }

    const hasNormals = nrm.length > 0;
    const vertexData: number[] = [];
    const indexData: number[] = [];
    const vertexMap = new Map<string, number>();
    let uniqueCounter = 0;

    for (const face of faces) {
      let nx = 0, ny = 1, nz = 0;

      if (!hasNormals) {
        const [p0, p1, p2] = face.slice(0, 3).map(v => v[0]);
        const ax = pos[p1*3]   - pos[p0*3],   ay = pos[p1*3+1] - pos[p0*3+1], az = pos[p1*3+2] - pos[p0*3+2];
        const bx = pos[p2*3]   - pos[p0*3],   by = pos[p2*3+1] - pos[p0*3+1], bz = pos[p2*3+2] - pos[p0*3+2];
        nx = ay*bz - az*by;
        ny = az*bx - ax*bz;
        nz = ax*by - ay*bx;
        const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
        if (len > 0) { nx /= len; ny /= len; nz /= len; }
      }

      const faceIndices: number[] = face.map(([p, t, n]) => {
        // When using flat normals, each vertex must be unique per face
        const key = hasNormals ? `${p}/${t}/${n}` : String(uniqueCounter++);
        let idx = vertexMap.get(key);
        if (idx === undefined) {
          idx = vertexData.length / 8;
          vertexMap.set(key, idx);
          vertexData.push(
            pos[p*3], pos[p*3+1], pos[p*3+2],
            hasNormals && n >= 0 ? nrm[n*3]   : nx,
            hasNormals && n >= 0 ? nrm[n*3+1] : ny,
            hasNormals && n >= 0 ? nrm[n*3+2] : nz,
            t >= 0 ? tex[t*2]   : 0,
            t >= 0 ? tex[t*2+1] : 0,
          );
        }
        return idx;
      });

      // Fan triangulation: (0,1,2), (0,2,3), ...
      for (let i = 1; i < faceIndices.length - 1; i++) {
        indexData.push(faceIndices[0], faceIndices[i], faceIndices[i + 1]);
      }
    }

    const vertexCount = vertexData.length / 8;
    if (vertexCount > 65535)
      throw new Error(`ObjLoader: ${vertexCount} unique vertices exceeds Uint16 limit (65535)`);

    return {
      vertices: new Float32Array(vertexData),
      indices: new Uint16Array(indexData),
    };
  }

  static async load(url: string): Promise<ObjData> {
    const text = await fetch(url).then(r => r.text());
    return ObjLoader.parse(text);
  }
}
