import { Vec3 } from '../math/Vec3';
import { Mat4 } from '../math/Mat4';

export interface TopDownCameraOptions {
  height?: number;
  pitch?: number;
  fov?: number;
  near?: number;
  far?: number;
  orthographic?: boolean;
  orthoSize?: number;
  target?: Vec3;
}

export class TopDownCamera {
  target: Vec3;
  readonly height: number;
  readonly pitch: number;
  readonly fov: number;
  readonly near: number;
  readonly far: number;
  readonly orthographic: boolean;
  readonly orthoSize: number;

  constructor(opts: TopDownCameraOptions = {}) {
    this.target = opts.target ?? new Vec3(0, 0, 0);
    this.height = opts.height ?? 10;
    // Clamp pitch away from horizontal to keep mouseWorld ray valid
    this.pitch = Math.max(opts.pitch ?? Math.PI / 3, Math.PI / 8);
    this.fov = opts.fov ?? Math.PI / 4;
    this.near = opts.near ?? 0.1;
    this.far = opts.far ?? 200;
    this.orthographic = opts.orthographic ?? false;
    this.orthoSize = opts.orthoSize ?? 8;
  }

  get position(): Vec3 {
    return new Vec3(
      this.target.x,
      this.target.y + this.height,
      this.target.z + this.height / Math.tan(this.pitch),
    );
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
