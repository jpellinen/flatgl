import { RenderContext } from '@/renderer/RenderContext';
import { Resource } from '@/renderer/Resource';
import { Shader } from '@/renderer/Shader';
import { Texture } from '@/renderer/Texture';

export class Material extends Resource {
  private textures = new Map<number, { texture: Texture; name: string }>();
  private floats = new Map<string, number>();
  private vec3s = new Map<string, [number, number, number]>();
  private mat4s = new Map<string, Float32Array>();

  constructor(context: RenderContext, private shader: Shader) {
    super(context);
  }

  bind(): void {
    this.shader.use();
    for (const [name, v] of this.floats) {
      const loc = this.shader.uniformLocation(name);
      if (loc !== null) this.gl.uniform1f(loc, v);
    }
    for (const [name, [x, y, z]] of this.vec3s) {
      const loc = this.shader.uniformLocation(name);
      if (loc !== null) this.gl.uniform3f(loc, x, y, z);
    }
    for (const [name, value] of this.mat4s) {
      const loc = this.shader.uniformLocation(name);
      if (loc !== null) this.gl.uniformMatrix4fv(loc, false, value);
    }
    for (const [unit, { texture, name }] of this.textures) {
      texture.bind(unit);
      const loc = this.shader.uniformLocation(name);
      if (loc !== null) this.gl.uniform1i(loc, unit);
    }
  }

  setFloat(name: string, v: number): void {
    this.floats.set(name, v);
    const loc = this.shader.uniformLocation(name);
    if (loc === null) return;
    this.gl.uniform1f(loc, v);
  }

  setVec3(name: string, x: number, y: number, z: number): void {
    this.vec3s.set(name, [x, y, z]);
    const loc = this.shader.uniformLocation(name);
    if (loc === null) return;
    this.gl.uniform3f(loc, x, y, z);
  }

  setMatrix4(name: string, value: Float32Array): void {
    this.mat4s.set(name, value);
    const loc = this.shader.uniformLocation(name);
    if (loc === null) return;
    this.gl.uniformMatrix4fv(loc, false, value);
  }

  setTexture(name: string, texture: Texture, unit: number = 0): void {
    const loc = this.shader.uniformLocation(name);
    if (loc === null) return;
    this.textures.set(unit, { texture, name });
    texture.bind(unit);
    this.gl.uniform1i(loc, unit);
  }

  destroy(): void {
    this.shader.destroy();
  }
}
