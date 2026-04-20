import { RenderContext } from './RenderContext';
import { Resource } from './Resource';

export class Buffer extends Resource {
  private handle: WebGLBuffer;

  private usage: number;

  constructor(context: RenderContext, data: Float32Array, usage?: number) {
    super(context);
    this.usage = usage ?? this.gl.STATIC_DRAW;

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
    this.gl.vertexAttribPointer(loc, size, this.gl.FLOAT, false, stride, offset);
  }

  destroy(): void {
    this.gl.deleteBuffer(this.handle);
  }
}
