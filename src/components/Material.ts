import { RenderContext } from '@/renderer/RenderContext';
import { Resource } from '@/renderer/Resource';
import { Shader } from '@/renderer/Shader';
import { Texture } from '@/renderer/Texture';

export class Material extends Resource {
  private textures = new Map<number, Texture>();

  constructor(context: RenderContext, readonly shader: Shader) {
    super(context);
  }

  bind(): void {
    this.shader.use();
    for (const [unit, texture] of this.textures) texture.bind(unit);
  }

  setFloat(name: string, v: number): void {
    const loc = this.shader.uniformLocation(name);
    if (loc === null) return;
    this.gl.uniform1f(loc, v);
  }

  setVec3(name: string, x: number, y: number, z: number): void {
    const loc = this.shader.uniformLocation(name);
    if (loc === null) return;
    this.gl.uniform3f(loc, x, y, z);
  }

  setMatrix4(name: string, value: Float32Array): void {
    const loc = this.shader.uniformLocation(name);
    if (loc === null) return;
    this.gl.uniformMatrix4fv(loc, false, value);
  }

  setTexture(name: string, texture: Texture, unit: number = 0): void {
    const loc = this.shader.uniformLocation(name);
    if (loc === null) return;
    this.textures.set(unit, texture);
    texture.bind(unit);
    this.gl.uniform1i(loc, unit);
  }

  destroy(): void {
    this.shader.destroy();
  }
}
