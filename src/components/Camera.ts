import { Vec3 } from '@/math/Vec3';
import { Mat4 } from '@/math/Mat4';

export class Camera {
  constructor(
    public position: Vec3,
    public target: Vec3,
    public up: Vec3,
    public fov: number,
    public near: number,
    public far: number,
  ) {}

  viewMatrix(): Mat4 {
    return Mat4.lookAt(this.position, this.target, this.up);
  }

  projectionMatrix(aspect: number): Mat4 {
    return Mat4.perspective(this.fov, aspect, this.near, this.far);
  }
}
