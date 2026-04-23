import { RenderContext } from './RenderContext';
import { Resource } from './Resource';

interface TextureDescriptor {
  wrap: number;
  minFilter: number;
  magFilter: number;
  internalFormat: number;
  format: number;
  type: number;
  width?: number;
  height?: number;
  data?: ArrayBufferView | TexImageSource | null;
  generateMipmap?: boolean;
  compareMode?: number;
  compareFunc?: number;
}

export class Texture extends Resource {
  private handle: WebGLTexture;

  private constructor(context: RenderContext, handle: WebGLTexture) {
    super(context);
    this.handle = handle;
  }

  private static configure(
    context: RenderContext,
    desc: TextureDescriptor,
  ): Texture {
    const gl = context.gl;
    const handle = gl.createTexture();
    if (!handle) throw new Error('Failed to create texture');
    gl.bindTexture(gl.TEXTURE_2D, handle);

    if (
      desc.data instanceof HTMLImageElement ||
      desc.data instanceof ImageBitmap ||
      desc.data instanceof HTMLCanvasElement ||
      desc.data instanceof HTMLVideoElement
    ) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        desc.internalFormat,
        desc.format,
        desc.type,
        desc.data,
      );
    } else {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        desc.internalFormat,
        desc.width!,
        desc.height!,
        0,
        desc.format,
        desc.type,
        (desc.data ?? null) as ArrayBufferView | null,
      );
    }

    if (desc.generateMipmap) gl.generateMipmap(gl.TEXTURE_2D);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, desc.wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, desc.wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, desc.minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, desc.magFilter);

    if (desc.compareMode !== undefined)
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_COMPARE_MODE,
        desc.compareMode,
      );
    if (desc.compareFunc !== undefined)
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_COMPARE_FUNC,
        desc.compareFunc,
      );

    gl.bindTexture(gl.TEXTURE_2D, null);
    return new Texture(context, handle);
  }

  static fromData(
    context: RenderContext,
    data: Uint8Array,
    width: number,
    height: number,
  ): Texture {
    const gl = context.gl;
    return Texture.configure(context, {
      wrap: gl.CLAMP_TO_EDGE,
      minFilter: gl.LINEAR,
      magFilter: gl.NEAREST,
      internalFormat: gl.RGBA,
      format: gl.RGBA,
      type: gl.UNSIGNED_BYTE,
      width,
      height,
      data,
    });
  }

  static load(context: RenderContext, url: string): Promise<Texture> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const gl = context.gl;
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        resolve(
          Texture.configure(context, {
            wrap: gl.REPEAT,
            minFilter: gl.LINEAR_MIPMAP_LINEAR,
            magFilter: gl.LINEAR,
            internalFormat: gl.RGBA,
            format: gl.RGBA,
            type: gl.UNSIGNED_BYTE,
            data: img,
            generateMipmap: true,
          }),
        );
      };
      img.onerror = () => reject(new Error(`Failed to load texture: ${url}`));
      img.src = url;
    });
  }

  static createRenderTarget(
    context: RenderContext,
    width: number,
    height: number,
  ): Texture {
    const gl = context.gl;
    return Texture.configure(context, {
      wrap: gl.CLAMP_TO_EDGE,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      internalFormat: gl.RGBA,
      format: gl.RGBA,
      type: gl.UNSIGNED_BYTE,
      width,
      height,
      data: null,
    });
  }

  static createDepth(
    context: RenderContext,
    width: number,
    height: number,
  ): Texture {
    const gl = context.gl;
    return Texture.configure(context, {
      wrap: gl.CLAMP_TO_EDGE,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      internalFormat: gl.DEPTH_COMPONENT32F,
      format: gl.DEPTH_COMPONENT,
      type: gl.FLOAT,
      width,
      height,
      data: null,
      compareMode: gl.COMPARE_REF_TO_TEXTURE,
      compareFunc: gl.LEQUAL,
    });
  }

  /** @internal — for use by Framebuffer only */
  get _handle(): WebGLTexture {
    return this.handle;
  }

  bind(unit: number = 0): void {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.handle);
  }

  destroy(): void {
    this.gl.deleteTexture(this.handle);
  }
}
