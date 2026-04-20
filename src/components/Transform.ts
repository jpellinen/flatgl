import { Vec3 } from '@/math/Vec3';
import { Mat4 } from '@/math/Mat4';

export class Transform {
  constructor(
    public position: Vec3 = new Vec3(0, 0, 0),
    public rotation: Vec3 = new Vec3(0, 0, 0),
    public scale: Vec3 = new Vec3(1, 1, 1),
  ) {}

  static identity(): Transform {
    return new Transform();
  }

  // Returns T * Rx * Ry * Rz * S (TRS order)
  matrix(): Mat4 {
    return Mat4.translation(this.position)
      .multiply(Mat4.rotationX(this.rotation.x))
      .multiply(Mat4.rotationY(this.rotation.y))
      .multiply(Mat4.rotationZ(this.rotation.z))
      .multiply(Mat4.scaling(this.scale));
  }
}
