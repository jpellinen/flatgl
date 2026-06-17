import { Component } from '@/core/Component';
import { Vec3 } from '@/math/Vec3';

export class DirectionalLight extends Component {
  constructor(
    public direction: Vec3,
    public color: Vec3,
    public intensity: number,
    public ambient: number,
  ) {
    super();
  }
}
