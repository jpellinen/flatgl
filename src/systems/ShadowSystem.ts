import { System } from '@/core/System';
import { World } from '@/core/World';
import { RenderContext } from '@/renderer/RenderContext';
import { Framebuffer } from '@/renderer/Framebuffer';
import { Shader } from '@/renderer/Shader';
import { Material } from '@/components/Material';
import { Mesh } from '@/components/Mesh';
import { Transform } from '@/components/Transform';
import { Mat4 } from '@/math/Mat4';

export class ShadowSystem implements System {
  private material: Material;

  constructor(
    private context: RenderContext,
    private world: World,
    private target: Framebuffer,
    shader: Shader,
    private lightSpaceMatrix: Mat4,
  ) {
    this.material = new Material(context, shader);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(_dt: number): void {
    const { gl } = this.context;

    this.target.bind();
    gl.clear(gl.DEPTH_BUFFER_BIT);

    this.material.bind();
    this.material.setMatrix4('u_lightSpaceMatrix', this.lightSpaceMatrix.array);

    for (const entity of this.world.query(Mesh, Transform)) {
      const mesh = this.world.get(entity, Mesh)!;
      const transform = this.world.get(entity, Transform)!;

      this.material.setMatrix4('u_model', transform.matrix().array);

      mesh.draw();
    }
  }

  destroy(): void {
    this.material.destroy();
  }
}
