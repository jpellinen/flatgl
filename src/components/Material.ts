import { RenderContext } from '@/renderer/RenderContext';
import { Resource } from '@/renderer/Resource';
import { Shader } from '@/renderer/Shader';
import { Texture } from '@/renderer/Texture';

export class Material extends Resource {
  private textures = new Map<number, { texture: Texture; name: string }>();

  constructor(context: RenderContext, private shader: Shader) {
    super(context);
  }

  bind(): void {
    this.shader.use();
    for (const [unit, { texture, name }] of this.textures) {
      texture.bind(unit);
      const loc = this.shader.uniformLocation(name);
      if (loc !== null) this.gl.uniform1i(loc, unit);
    }
  }

  setTexture(name: string, texture: Texture, unit: number = 0): void {
    this.textures.set(unit, { texture, name });
  }

  setFloat(name: string, v: number): void {
    const loc = this.shader.uniformLocation(name);
    if (loc !== null) this.gl.uniform1f(loc, v);
  }

  setVec3(name: string, x: number, y: number, z: number): void {
    const loc = this.shader.uniformLocation(name);
    if (loc !== null) this.gl.uniform3f(loc, x, y, z);
  }

  setMatrix4(name: string, value: Float32Array): void {
    const loc = this.shader.uniformLocation(name);
    if (loc !== null) this.gl.uniformMatrix4fv(loc, false, value);
  }

  destroy(): void {
    this.shader.destroy();
  }
}
