import { Mat4 } from '@/math/Mat4';
import { Vec3 } from '@/math/Vec3';
import { Framebuffer } from '@/renderer/Framebuffer';
import { RenderContext } from '@/renderer/RenderContext';
import { Shader } from '@/renderer/Shader';
import { Material } from '@/components/Material';
import { Mesh } from '@/components/Mesh';
import { Transform } from '@/components/Transform';
import { System } from '@/core/System';
import { World } from '@/core/World';

type Plane = [number, number, number, number];

function inFrustum(planes: Plane[], center: Vec3, radius: number): boolean {
  for (const [a, b, c, d] of planes) {
    if (a * center.x + b * center.y + c * center.z + d < -radius) return false;
  }
  return true;
}

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

  render(): void {
    const { gl } = this.context;

    this.target.bind();
    gl.clear(gl.DEPTH_BUFFER_BIT);

    this.material.bind();
    this.material.setMatrix4('u_lightSpaceMatrix', this.lightSpaceMatrix.array);

    const planes = this.lightSpaceMatrix.frustumPlanes();

    for (const entity of this.world.query(Mesh, Transform)) {
      const mesh = this.world.get(entity, Mesh)!;
      const transform = this.world.get(entity, Transform)!;

      if (mesh.boundingSphere !== null && !inFrustum(planes, transform.position, mesh.boundingSphere.radius)) continue;

      this.material.setMatrix4('u_model', transform.matrix().array);
      mesh.draw();
    }
  }

  destroy(): void {
    this.material.destroy();
  }
}
