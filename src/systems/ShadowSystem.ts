import { Mat4 } from '@/math/Mat4';
import { inFrustumXYZ } from '@/math/Frustum';
import { Framebuffer } from '@/renderer/Framebuffer';
import { RenderContext } from '@/renderer/RenderContext';
import { Shader } from '@/renderer/Shader';
import { Material } from '@/components/Material';
import { Mesh } from '@/components/Mesh';
import { SkinnedMesh } from '@/components/SkinnedMesh';
import { Skeleton } from '@/components/Skeleton';
import { Transform, getWorldMatrix } from '@/components/Transform';
import type { Entity } from '@/core/Entity';
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

    const drawEntity = (entity: Entity): void => {
      const mesh = (this.world.get(entity, SkinnedMesh) ??
        this.world.get(entity, Mesh))!;
      const worldMat = getWorldMatrix(entity, this.world);

      if (mesh.boundingSphere !== null) {
        const b = worldMat.array;
        const lc = mesh.boundingSphere.center;
        const cx = b[0] * lc.x + b[4] * lc.y + b[8] * lc.z + b[12];
        const cy = b[1] * lc.x + b[5] * lc.y + b[9] * lc.z + b[13];
        const cz = b[2] * lc.x + b[6] * lc.y + b[10] * lc.z + b[14];
        const bsx = Math.sqrt(b[0] * b[0] + b[1] * b[1] + b[2] * b[2]);
        const bsy = Math.sqrt(b[4] * b[4] + b[5] * b[5] + b[6] * b[6]);
        const bsz = Math.sqrt(b[8] * b[8] + b[9] * b[9] + b[10] * b[10]);
        const sr = mesh.boundingSphere.radius * Math.max(bsx, bsy, bsz);
        if (!inFrustumXYZ(planes, cx, cy, cz, sr)) return;
      }

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
    };

    for (const entity of this.world.query(Mesh, Transform)) drawEntity(entity);
    for (const entity of this.world.query(SkinnedMesh, Transform))
      drawEntity(entity);
  }

  destroy(): void {
    this.material.destroy();
    this.skinnedMaterial?.destroy();
  }
}
