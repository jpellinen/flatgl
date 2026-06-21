import { RenderContext } from './RenderContext';
import { Resource } from './Resource';
import { Texture } from './Texture';

export class Framebuffer extends Resource {
  readonly texture: Texture;
  readonly depthTexture: Texture | null;
  readonly width: number;
  readonly height: number;
  private fbo: WebGLFramebuffer;

  private constructor(
    context: RenderContext,
    fbo: WebGLFramebuffer,
    texture: Texture,
    depthTexture: Texture | null,
    width: number,
    height: number,
  ) {
    super(context);
    this.fbo = fbo;
    this.texture = texture;
    this.depthTexture = depthTexture;
    this.width = width;
    this.height = height;
  }

  static create(
    context: RenderContext,
    width: number,
    height: number,
  ): Framebuffer {
    const gl = context.gl;

    const texture = Texture.createRenderTarget(context, width, height);
    const depthTexture = Texture.createDepthTarget(context, width, height);

    const fbo = gl.createFramebuffer();
    if (!fbo) throw new Error('Failed to create framebuffer');
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture._handle,
      0,
    );
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.DEPTH_ATTACHMENT,
      gl.TEXTURE_2D,
      depthTexture._handle,
      0,
    );

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE)
      throw new Error(`Framebuffer incomplete: 0x${status.toString(16)}`);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return new Framebuffer(context, fbo, texture, depthTexture, width, height);
  }

  static createDepthOnly(
    context: RenderContext,
    width: number,
    height: number,
  ): Framebuffer {
    const gl = context.gl;

    const texture = Texture.createDepth(context, width, height);

    const fbo = gl.createFramebuffer();
    if (!fbo) throw new Error('Failed to create shadow framebuffer');
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.DEPTH_ATTACHMENT,
      gl.TEXTURE_2D,
      texture._handle,
      0,
    );
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE)
      throw new Error(
        `Shadow framebuffer incomplete: 0x${status.toString(16)}`,
      );

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return new Framebuffer(context, fbo, texture, null, width, height);
  }

  bind(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbo);
    this.gl.viewport(0, 0, this.width, this.height);
  }

  destroy(): void {
    this.texture.destroy();
    this.depthTexture?.destroy();
    this.gl.deleteFramebuffer(this.fbo);
  }
}
