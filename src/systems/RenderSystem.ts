import { System } from '@/core/System';
import { World } from '@/core/World';
import { RenderContext } from '@/renderer/RenderContext';
import { Framebuffer } from '@/renderer/Framebuffer';
import { Mesh } from '@/components/Mesh';
import { Material } from '@/components/Material';
import { Transform } from '@/components/Transform';
import { DirectionalLight } from '@/components/DirectionalLight';
import { Camera } from '@/components/Camera';

export class RenderSystem implements System {
  constructor(
    private context: RenderContext,
    private world: World,
    private target?: Framebuffer,
    private aspect?: number,
  ) {}

  setTarget(fb: Framebuffer): void { this.target = fb; }
  setAspect(aspect: number): void { this.aspect = aspect; }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(_dt: number): void {
    const { gl } = this.context;

    if (this.target) {
      this.target.bind();
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const lightEntity = this.world.query(DirectionalLight)[0];
    const light = lightEntity !== undefined ? this.world.get(lightEntity, DirectionalLight)! : null;

    const cameraEntity = this.world.query(Camera)[0];
    const camera = cameraEntity !== undefined ? this.world.get(cameraEntity, Camera) : undefined;

    const groups = new Map<Material, number[]>();
    for (const entity of this.world.query(Mesh, Material)) {
      const mat = this.world.get(entity, Material)!;
      let group = groups.get(mat);
      if (!group) { group = []; groups.set(mat, group); }
      group.push(entity);
    }

    for (const [material, entities] of groups) {
      material.bind();
      if (camera && this.aspect !== undefined) {
        material.setMatrix4('u_view', camera.viewMatrix().array);
        material.setMatrix4('u_projection', camera.projectionMatrix(this.aspect).array);
      }
      if (light) {
        material.setVec3('u_lightDir', light.direction.x, light.direction.y, light.direction.z);
        material.setVec3('u_lightColor', light.color.x, light.color.y, light.color.z);
        material.setFloat('u_lightIntensity', light.intensity);
        material.setFloat('u_ambientIntensity', light.ambient);
      }
      for (const entity of entities) {
        const transform = this.world.get(entity, Transform);
        if (transform) material.setMatrix4('u_model', transform.matrix().array);
        this.world.get(entity, Mesh)!.draw();
      }
    }
  }
}
