import { RenderContext } from '../renderer/RenderContext';
import { Framebuffer } from '../renderer/Framebuffer';
import { Buffer } from '../renderer/Buffer';
import { Shader } from '../renderer/Shader';
import { Mesh } from '../components/Mesh';
import { Vec3 } from '../math/Vec3';

import screenVertSrc from '../shaders/screen.vert.glsl';
import screenFragSrc from '../shaders/screen.frag.glsl';

export interface FogOptions {
  color?: Vec3;
  near?: number;
  far?: number;
}

export interface PostProcessOptions {
  fxaa?: boolean;
  contrast?: number;
  saturation?: number;
  fog?: FogOptions;
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
      -1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, -1, 1, 0, 1, 1, 1, 1, -1, 1, 0,
      1,
    ]);
    const buf = new Buffer(context, quadData);
    const posLoc = this.shader.attribLocation('a_position');
    const uvLoc = this.shader.attribLocation('a_uv');
    this.quad = new Mesh(
      context,
      buf,
      [
        { loc: posLoc, size: 2, stride: 16, offset: 0 },
        { loc: uvLoc, size: 2, stride: 16, offset: 8 },
      ],
      { vertexCount: 6 },
    );
  }

  render(
    sceneFb: Framebuffer,
    width: number,
    height: number,
    cameraNear: number,
    cameraFar: number,
  ): void {
    const { gl } = this.context;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.shader.use();
    sceneFb.texture.bind(0);
    sceneFb.depthTexture?.bind(1);

    const u = (name: string) => this.shader.uniformLocation(name);
    const s = u('u_screen');
    if (s) gl.uniform1i(s, 0);
    const d = u('u_depth');
    if (d) gl.uniform1i(d, 1);
    const t = u('u_texelSize');
    if (t) gl.uniform2f(t, 1 / width, 1 / height);
    const f = u('u_fxaa');
    if (f) gl.uniform1f(f, this.opts.fxaa === false ? 0.0 : 1.0);
    const c = u('u_contrast');
    if (c) gl.uniform1f(c, this.opts.contrast ?? 1.0);
    const a = u('u_saturation');
    if (a) gl.uniform1f(a, this.opts.saturation ?? 1.0);

    const fog = this.opts.fog;
    const fe = u('u_fogEnabled');
    if (fe) gl.uniform1f(fe, fog ? 1.0 : 0.0);
    if (fog) {
      const fogColor = fog.color ?? new Vec3(0.7, 0.75, 0.8);
      const fn = u('u_fogNear');
      if (fn) gl.uniform1f(fn, fog.near ?? 20);
      const ff = u('u_fogFar');
      if (ff) gl.uniform1f(ff, fog.far ?? 100);
      const fc = u('u_fogColor');
      if (fc) gl.uniform3f(fc, fogColor.x, fogColor.y, fogColor.z);
      const cn = u('u_cameraNear');
      if (cn) gl.uniform1f(cn, cameraNear);
      const cf = u('u_cameraFar');
      if (cf) gl.uniform1f(cf, cameraFar);
    }

    this.quad.draw();
    gl.enable(gl.DEPTH_TEST);
  }

  destroy(): void {
    this.quad.destroy();
    this.shader.destroy();
  }
}
