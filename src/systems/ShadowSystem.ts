import { Mat4 } from '@/math/Mat4';
import { Vec3 } from '@/math/Vec3';
import { inFrustum } from '@/math/Frustum';
import { Framebuffer } from '@/renderer/Framebuffer';
import { RenderContext } from '@/renderer/RenderContext';
import { Shader } from '@/renderer/Shader';
import { Material } from '@/components/Material';
import { Mesh } from '@/components/Mesh';
import { SkinnedMesh } from '@/components/SkinnedMesh';
import { Skeleton } from '@/components/Skeleton';
import { Transform, getWorldMatrix } from '@/components/Transform';
import { System } from '@/core/System';
import { World } from '@/core/World';

export class ShadowSystem implements System {
  drawCalls = 0;

  private material: Material;
  private skinnedMaterial: Material | null;

  constructor(
    private context: RenderContext,
    private world: World,
    private target: Framebuffer,
    shader: Shader,
    private lightSpaceMatrix: Mat4,
    skinnedShader?: Shader,
  ) {
    this.material = new Material(context, shader);
    this.skinnedMaterial = skinnedShader
      ? new Material(context, skinnedShader)
      : null;
  }

  render(): void {
    this.drawCalls = 0;
    const { gl } = this.context;

    this.target.bind();
    gl.clear(gl.DEPTH_BUFFER_BIT);

    const planes = this.lightSpaceMatrix.frustumPlanes();
    let activeMaterial: Material | null = null;

    const entities = [
      ...this.world.query(Mesh, Transform),
      ...this.world.query(SkinnedMesh, Transform),
    ];

    for (const entity of entities) {
      const mesh = (this.world.get(entity, SkinnedMesh) ??
        this.world.get(entity, Mesh))!;
      const worldMat = getWorldMatrix(entity, this.world);
      const center = new Vec3(
        worldMat.array[12],
        worldMat.array[13],
        worldMat.array[14],
      );
      if (
        mesh.boundingSphere !== null &&
        !inFrustum(planes, center, mesh.boundingSphere.radius)
      )
        continue;

      const skeleton = this.world.get(entity, Skeleton);
      const targetMat =
        skeleton && this.skinnedMaterial ? this.skinnedMaterial : this.material;

      if (activeMaterial !== targetMat) {
        targetMat.bind();
        targetMat.setMatrix4('u_lightSpaceMatrix', this.lightSpaceMatrix.array);
        activeMaterial = targetMat;
      }
      targetMat.setMatrix4('u_model', worldMat.array);
      if (skeleton)
        targetMat.setMatrix4('u_jointMatrices[0]', skeleton.jointMatrices);
      mesh.draw();
      this.drawCalls++;
    }
  }

  destroy(): void {
    this.material.destroy();
    this.skinnedMaterial?.destroy();
  }
}
