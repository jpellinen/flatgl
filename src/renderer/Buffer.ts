import { RenderContext } from './RenderContext';
import { Resource } from './Resource';

export const BufferUsage = {
  STATIC_DRAW:  WebGL2RenderingContext.STATIC_DRAW,
  DYNAMIC_DRAW: WebGL2RenderingContext.DYNAMIC_DRAW,
  STREAM_DRAW:  WebGL2RenderingContext.STREAM_DRAW,
} as const;

export type BufferUsage = typeof BufferUsage[keyof typeof BufferUsage];

export class Buffer extends Resource {
  private handle: WebGLBuffer;

  private usage: BufferUsage;

  constructor(context: RenderContext, data: Float32Array, usage?: BufferUsage) {
    super(context);
    this.usage = usage ?? BufferUsage.STATIC_DRAW;

    const buf = this.gl.createBuffer();
    if (!buf) throw new Error('Failed to create buffer');
    this.handle = buf;
    this.bind();
    this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.usage);
  }

  bind(): void {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.handle);
  }

  setAttrib(loc: number, size: number, stride: number, offset: number): void {
    this.gl.enableVertexAttribArray(loc);
    this.gl.vertexAttribPointer(
      loc,
      size,
      this.gl.FLOAT,
      false,
      stride,
      offset,
    );
  }

  setInstanceAttrib(
    loc: number,
    size: number,
    stride: number,
    offset: number,
  ): void {
    this.setAttrib(loc, size, stride, offset);
    this.gl.vertexAttribDivisor(loc, 1);
  }

  update(data: Float32Array, byteOffset = 0): void {
    this.bind();
    this.gl.bufferSubData(this.gl.ARRAY_BUFFER, byteOffset, data);
  }

  destroy(): void {
    this.gl.deleteBuffer(this.handle);
  }
}
