export class RenderContext {
  private constructor(private readonly _gl: WebGL2RenderingContext) {}

  /** @internal */
  get gl(): WebGL2RenderingContext {
    return this._gl;
  }

  static create(canvas: HTMLCanvasElement): RenderContext {
    const gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('WebGL 2 not supported');
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    return new RenderContext(gl);
  }
}
