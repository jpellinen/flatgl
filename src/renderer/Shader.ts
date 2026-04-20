import { RenderContext } from './RenderContext';
import { Resource } from './Resource';

export class Shader extends Resource {
  private program: WebGLProgram;
  private attribCache = new Map<string, number>();
  private uniformCache = new Map<string, WebGLUniformLocation | null>();

  private constructor(context: RenderContext, program: WebGLProgram) {
    super(context);
    this.program = program;
  }

  static fromSource(context: RenderContext, vsSource: string, fsSource: string): Shader {
    const gl = context.gl;
    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    if (!program) throw new Error('Failed to create program');
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(program) ?? 'Link error');
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return new Shader(context, program);
  }

  static async load(context: RenderContext, vsUrl: string, fsUrl: string): Promise<Shader> {
    const [vsSource, fsSource] = await Promise.all([
      fetch(vsUrl).then(r => { if (!r.ok) throw new Error(`Failed to load shader: ${vsUrl}`); return r.text(); }),
      fetch(fsUrl).then(r => { if (!r.ok) throw new Error(`Failed to load shader: ${fsUrl}`); return r.text(); }),
    ]);
    return Shader.fromSource(context, vsSource, fsSource);
  }

  use(): void {
    this.gl.useProgram(this.program);
  }

  attribLocation(name: string): number {
    if (!this.attribCache.has(name))
      this.attribCache.set(name, this.gl.getAttribLocation(this.program, name));
    return this.attribCache.get(name)!;
  }

  uniformLocation(name: string): WebGLUniformLocation | null {
    if (!this.uniformCache.has(name))
      this.uniformCache.set(name, this.gl.getUniformLocation(this.program, name));
    return this.uniformCache.get(name) ?? null;
  }

  destroy(): void {
    this.gl.deleteProgram(this.program);
  }
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader compile error');
  }
  return shader;
}
