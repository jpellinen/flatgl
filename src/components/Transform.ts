import { Component } from '@/core/Component';
import { Vec3 } from '@/math/Vec3';
import { Mat4 } from '@/math/Mat4';
import { Entity } from '@/core/Entity';
import { World } from '@/core/World';

export class Transform extends Component {
  constructor(
    public position: Vec3 = new Vec3(0, 0, 0),
    public rotation: Vec3 = new Vec3(0, 0, 0),
    public scale: Vec3 = new Vec3(1, 1, 1),
    public parent?: Entity,
  ) {
    super();
  }

  // Returns T * Rx * Ry * Rz * S (TRS order), local space
  matrix(): Mat4 {
    return Mat4.translation(this.position)
      .multiply(Mat4.rotationX(this.rotation.x))
      .multiply(Mat4.rotationY(this.rotation.y))
      .multiply(Mat4.rotationZ(this.rotation.z))
      .multiply(Mat4.scaling(this.scale));
  }
}

export function getWorldMatrix(entity: Entity, world: World, _depth = 0): Mat4 {
  if (_depth > 32) throw new Error('Transform: cyclic parent chain detected');
  const t = world.get(entity, Transform);
  if (!t) return Mat4.identity();
  const local = t.matrix();
  if (t.parent === undefined) return local;
  return getWorldMatrix(t.parent, world, _depth + 1).multiply(local);
}
