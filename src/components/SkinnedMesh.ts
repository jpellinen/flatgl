import { RenderContext } from '@/renderer/RenderContext';
import { Buffer } from '@/renderer/Buffer';
import { Mesh, AttribDescriptor, MeshOptions } from './Mesh';

export class SkinnedMesh extends Mesh {
  private skinBuffer: Buffer;

  constructor(
    context: RenderContext,
    buffer: Buffer,
    attribs: AttribDescriptor[],
    skinBuffer: Buffer,
    options: MeshOptions = {},
  ) {
    super(context, buffer, attribs, options);
    this.skinBuffer = skinBuffer;

    this.gl.bindVertexArray(this.vao);
    skinBuffer.bind();
    skinBuffer.setIntAttrib(3, 4, this.gl.UNSIGNED_BYTE, 20, 0); // a_joints  uvec4
    skinBuffer.setAttrib(4, 4, 20, 4); //                           a_weights  vec4
    this.gl.bindVertexArray(null);
  }

  destroy(): void {
    this.skinBuffer.destroy();
    super.destroy();
  }
}
