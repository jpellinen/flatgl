import { RenderContext } from '../renderer/RenderContext';
import { Framebuffer } from '../renderer/Framebuffer';
import { Buffer } from '../renderer/Buffer';
import { Shader } from '../renderer/Shader';
import { Mesh } from '../components/Mesh';

import screenVertSrc from '../shaders/screen.vert.glsl';
import screenFragSrc from '../shaders/screen.frag.glsl';

export interface PostProcessOptions {
  fxaa?: boolean;
  contrast?: number;
  saturation?: number;
}

export class ScreenPass {
  private context: RenderContext;
  private shader: Shader;
  private quad: Mesh;
  private opts: PostProcessOptions;

  constructor(context: RenderContext, opts: PostProcessOptions) {
    this.context = context;
    this.opts = opts;
    this.shader = Shader.fromSource(context, screenVertSrc, screenFragSrc);
    const quadData = new Float32Array([
      -1, -1, 0, 0,   1, -1, 1, 0,   -1, 1, 0, 1,
       1, -1, 1, 0,   1,  1, 1, 1,   -1, 1, 0, 1,
    ]);
    const buf = new Buffer(context, quadData);
    const posLoc = this.shader.attribLocation('a_position');
    const uvLoc  = this.shader.attribLocation('a_uv');
    this.quad = new Mesh(context, buf, [
      { loc: posLoc, size: 2, stride: 16, offset: 0 },
      { loc: uvLoc,  size: 2, stride: 16, offset: 8 },
    ], { vertexCount: 6 });
  }

  render(sceneFb: Framebuffer, width: number, height: number): void {
    const { gl } = this.context;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.shader.use();
    sceneFb.texture.bind(0);

    const u = (name: string) => this.shader.uniformLocation(name);
    const s = u('u_screen');     if (s) gl.uniform1i(s, 0);
    const t = u('u_texelSize');  if (t) gl.uniform2f(t, 1 / width, 1 / height);
    const f = u('u_fxaa');       if (f) gl.uniform1f(f, this.opts.fxaa === false ? 0.0 : 1.0);
    const c = u('u_contrast');   if (c) gl.uniform1f(c, this.opts.contrast ?? 1.0);
    const a = u('u_saturation'); if (a) gl.uniform1f(a, this.opts.saturation ?? 1.0);

    this.quad.draw();
    gl.enable(gl.DEPTH_TEST);
  }

  destroy(): void {
    this.quad.destroy();
    this.shader.destroy();
  }
}
