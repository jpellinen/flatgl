import { System } from '@/core/System';
import { World } from '@/core/World';
import { RenderContext } from '@/renderer/RenderContext';
import { Framebuffer } from '@/renderer/Framebuffer';
import { Mesh } from '@/components/Mesh';
import { Material } from '@/components/Material';
import { Transform, getWorldMatrix } from '@/components/Transform';
import { Mat4 } from '@/math/Mat4';
import { Vec3 } from '@/math/Vec3';

export interface CameraLike {
  viewMatrix(): Mat4;
  projectionMatrix(aspect: number): Mat4;
  readonly position: Vec3;
}

export interface LightState {
  direction: Vec3;
  color: Vec3;
  intensity: number;
  ambient: number;
}

type Plane = [number, number, number, number];

function inFrustum(planes: Plane[], center: Vec3, radius: number): boolean {
  for (const [a, b, c, d] of planes) {
    if (a * center.x + b * center.y + c * center.z + d < -radius) return false;
  }
  return true;
}

export class RenderSystem implements System {
  drawCalls = 0;
  triangles = 0;
  visible = 0;
  total = 0;
  batches = 0;

  constructor(
    private context: RenderContext,
    private world: World,
    private camera: CameraLike,
    private light: LightState,
    private target?: Framebuffer,
    private aspect: number = 1,
    private clearColor: [number, number, number, number] = [0.08, 0.08, 0.12, 1],
  ) {}

  setTarget(fb: Framebuffer): void { this.target = fb; }
  setAspect(aspect: number): void { this.aspect = aspect; }

  render(): void {
    const { gl } = this.context;

    if (this.target) {
      this.target.bind();
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }

    gl.clearColor(...this.clearColor);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    this.drawCalls = 0;
    this.triangles = 0;
    this.visible = 0;
    this.total = 0;
    this.batches = 0;

    const view = this.camera.viewMatrix();
    const proj = this.camera.projectionMatrix(this.aspect);
    const planes = proj.multiply(view).frustumPlanes();

    const allEntities = this.world.query(Mesh, Material);
    this.total = allEntities.length;

    const groups = new Map<Material, number[]>();
    for (const entity of allEntities) {
      const mesh = this.world.get(entity, Mesh)!;
      const worldMat = this.world.get(entity, Transform) ? getWorldMatrix(entity, this.world) : null;
      const center = worldMat ? new Vec3(worldMat.array[12], worldMat.array[13], worldMat.array[14]) : new Vec3(0, 0, 0);

      if (mesh.boundingSphere !== null && !inFrustum(planes, center, mesh.boundingSphere.radius)) continue;

      this.visible++;
      const mat = this.world.get(entity, Material)!;
      let group = groups.get(mat);
      if (!group) { group = []; groups.set(mat, group); }
      group.push(entity);
    }
    this.batches = groups.size;

    const { direction, color, intensity, ambient } = this.light;
    const camPos = this.camera.position;

    for (const [material, entities] of groups) {
      material.bind();
      material.setMatrix4('u_view', view.array);
      material.setMatrix4('u_projection', proj.array);
      material.setVec3('u_cameraPos', camPos.x, camPos.y, camPos.z);
      material.setVec3('u_lightDir', direction.x, direction.y, direction.z);
      material.setVec3('u_lightColor', color.x, color.y, color.z);
      material.setFloat('u_lightIntensity', intensity);
      material.setFloat('u_ambientIntensity', ambient);
      for (const entity of entities) {
        const mesh = this.world.get(entity, Mesh)!;
        if (this.world.get(entity, Transform)) material.setMatrix4('u_model', getWorldMatrix(entity, this.world).array);
        mesh.draw();
        this.drawCalls++;
        this.triangles += mesh.indexCount > 0 ? mesh.indexCount / 3 : mesh.vertexCount / 3;
      }
    }
  }
}
