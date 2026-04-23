import { Vec3 } from '../math/Vec3';
import { Mat4 } from '../math/Mat4';

export interface CameraOptions {
  position?: Vec3;
  target?: Vec3;
  fov?: number;
  near?: number;
  far?: number;
  orthographic?: boolean;
  orthoSize?: number;
}

export class Camera {
  position: Vec3;
  target: Vec3;
  readonly fov: number;
  readonly near: number;
  readonly far: number;
  readonly orthographic: boolean;
  readonly orthoSize: number;

  constructor(opts: CameraOptions = {}) {
    this.position = opts.position ?? new Vec3(0, 6, 10);
    this.target = opts.target ?? new Vec3(0, 0, 0);
    this.fov = opts.fov ?? Math.PI / 4;
    this.near = opts.near ?? 0.1;
    this.far = opts.far ?? 200;
    this.orthographic = opts.orthographic ?? false;
    this.orthoSize = opts.orthoSize ?? 8;
  }

  viewMatrix(): Mat4 {
    return Mat4.lookAt(this.position, this.target, new Vec3(0, 1, 0));
  }

  projectionMatrix(aspect: number): Mat4 {
    if (this.orthographic) {
      return Mat4.ortho(
        -this.orthoSize * aspect,
        this.orthoSize * aspect,
        -this.orthoSize,
        this.orthoSize,
        this.near,
        this.far,
      );
    }
    return Mat4.perspective(this.fov, aspect, this.near, this.far);
  }
}
