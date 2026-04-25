import { RenderContext } from '@/renderer/RenderContext';
import { Resource } from '@/renderer/Resource';
import { Buffer } from '@/renderer/Buffer';
import { Vec3 } from '@/math/Vec3';

export const DrawMode = {
  TRIANGLES:      WebGL2RenderingContext.TRIANGLES,
  TRIANGLE_STRIP: WebGL2RenderingContext.TRIANGLE_STRIP,
  TRIANGLE_FAN:   WebGL2RenderingContext.TRIANGLE_FAN,
  LINES:          WebGL2RenderingContext.LINES,
  LINE_STRIP:     WebGL2RenderingContext.LINE_STRIP,
  LINE_LOOP:      WebGL2RenderingContext.LINE_LOOP,
  POINTS:         WebGL2RenderingContext.POINTS,
} as const;

export type DrawMode = typeof DrawMode[keyof typeof DrawMode];

interface AttribDescriptor {
  loc: number;
  size: number;
  stride: number;
  offset: number;
}

interface MeshOptions {
  indices?: Uint16Array;
  vertexCount?: number;
  mode?: DrawMode;
}

export class Mesh extends Resource {
  readonly vertexCount: number;
  readonly indexCount: number;
  readonly mode: DrawMode;
  private vao: WebGLVertexArrayObject;
  private ibo: WebGLBuffer | null = null;
  /** @internal — set by engine.assets.createMesh(); used for frustum culling */
  boundingSphere: { center: Vec3; radius: number } | null = null;

  constructor(
    context: RenderContext,
    buffer: Buffer,
    attribs: AttribDescriptor[],
    options: MeshOptions = {},
  ) {
    super(context);
    if (!options.indices && options.vertexCount === undefined)
      throw new Error('Mesh: vertexCount required for non-indexed draws');
    this.vertexCount = options.vertexCount ?? 0;
    this.mode = options.mode ?? DrawMode.TRIANGLES;

    const vao = this.gl.createVertexArray();
    if (!vao) throw new Error('Failed to create VAO');
    this.vao = vao;

    this.gl.bindVertexArray(this.vao);
    buffer.bind();
    for (const a of attribs) {
      buffer.setAttrib(a.loc, a.size, a.stride, a.offset);
    }

    if (options.indices) {
      this.indexCount = options.indices.length;
      const ibo = this.gl.createBuffer();
      if (!ibo) throw new Error('Failed to create index buffer');
      this.ibo = ibo;
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.ibo);
      this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, options.indices, this.gl.STATIC_DRAW);
    } else {
      this.indexCount = 0;
    }

    this.gl.bindVertexArray(null);
  }

  bind(): void {
    this.gl.bindVertexArray(this.vao);
  }

  draw(): void {
    this.bind();
    if (this.indexCount > 0) {
      this.gl.drawElements(this.mode, this.indexCount, this.gl.UNSIGNED_SHORT, 0);
    } else {
      this.gl.drawArrays(this.mode, 0, this.vertexCount);
    }
  }

  destroy(): void {
    if (this.ibo) this.gl.deleteBuffer(this.ibo);
    this.gl.deleteVertexArray(this.vao);
  }
}
