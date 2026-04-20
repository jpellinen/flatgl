import { RenderContext } from './RenderContext';
import { Resource } from './Resource';
import { Texture } from './Texture';

export class Framebuffer extends Resource {
  readonly texture: Texture;
  readonly width: number;
  readonly height: number;
  private fbo: WebGLFramebuffer;
  private depthRbo: WebGLRenderbuffer | null;

  private constructor(
    context: RenderContext,
    fbo: WebGLFramebuffer,
    depthRbo: WebGLRenderbuffer | null,
    texture: Texture,
    width: number,
    height: number,
  ) {
    super(context);
    this.fbo = fbo;
    this.depthRbo = depthRbo;
    this.texture = texture;
    this.width = width;
    this.height = height;
  }

  static create(context: RenderContext, width: number, height: number): Framebuffer {
    const gl = context.gl;

    const texture = Texture.createRenderTarget(context, width, height);

    const depthRbo = gl.createRenderbuffer();
    if (!depthRbo) throw new Error('Failed to create depth renderbuffer');
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthRbo);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);

    const fbo = gl.createFramebuffer();
    if (!fbo) throw new Error('Failed to create framebuffer');
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture._handle, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRbo);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE)
      throw new Error(`Framebuffer incomplete: 0x${status.toString(16)}`);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return new Framebuffer(context, fbo, depthRbo, texture, width, height);
  }

  static createDepthOnly(context: RenderContext, width: number, height: number): Framebuffer {
    const gl = context.gl;

    const texture = Texture.createDepth(context, width, height);

    const fbo = gl.createFramebuffer();
    if (!fbo) throw new Error('Failed to create shadow framebuffer');
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, texture._handle, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE)
      throw new Error(`Shadow framebuffer incomplete: 0x${status.toString(16)}`);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return new Framebuffer(context, fbo, null, texture, width, height);
  }

  bind(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbo);
    this.gl.viewport(0, 0, this.width, this.height);
  }

  destroy(): void {
    this.texture.destroy();
    if (this.depthRbo) this.gl.deleteRenderbuffer(this.depthRbo);
    this.gl.deleteFramebuffer(this.fbo);
  }
}
