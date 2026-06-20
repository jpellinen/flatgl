import { RenderContext } from '../renderer/RenderContext';
import { Framebuffer } from '../renderer/Framebuffer';
import { Shader } from '../renderer/Shader';
import { Texture } from '../renderer/Texture';
import { Mat4 } from '../math/Mat4';
import type { CameraLike } from '../systems/RenderSystem';

import skyboxVertSrc from '../shaders/skybox.vert.glsl';
import skyboxFragSrc from '../shaders/skybox.frag.glsl';

export class SkyboxPass {
  private context: RenderContext;
  private shader: Shader;
  private vao: WebGLVertexArrayObject;
  private texture: Texture;

  constructor(context: RenderContext, texture: Texture) {
    this.context = context;
    this.texture = texture;
    this.shader = Shader.fromSource(context, skyboxVertSrc, skyboxFragSrc);

    const vao = context.gl.createVertexArray();
    if (!vao) throw new Error('Failed to create skybox VAO');
    this.vao = vao;
  }

  render(target: Framebuffer, camera: CameraLike, aspect: number): void {
    const { gl } = this.context;

    target.bind();

    const viewArr = camera.viewMatrix().array;
    // prettier-ignore
    const rotationOnly = Mat4.fromArray([
      viewArr[0], viewArr[1], viewArr[2],  0,
      viewArr[4], viewArr[5], viewArr[6],  0,
      viewArr[8], viewArr[9], viewArr[10], 0,
      0,          0,          0,           1,
    ]);

    const vp = camera.projectionMatrix(aspect).multiply(rotationOnly);
    const inv = vp.invert();
    if (!inv) return;

    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(false);

    this.shader.use();
    const invLoc = this.shader.uniformLocation('u_invViewProjection');
    if (invLoc) gl.uniformMatrix4fv(invLoc, false, inv.array);

    const texLoc = this.shader.uniformLocation('u_skybox');
    if (texLoc) gl.uniform1i(texLoc, 0);
    this.texture.bind(0);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);

    gl.depthMask(true);
    gl.depthFunc(gl.LESS);
  }

  destroy(): void {
    this.shader.destroy();
    this.context.gl.deleteVertexArray(this.vao);
  }
}
