import { Vec3 } from '@/math/Vec3';

export class DirectionalLight {
  constructor(
    public direction: Vec3,
    public color: Vec3,
    public intensity: number,
    public ambient: number,
  ) {}
}
