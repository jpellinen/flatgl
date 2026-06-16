import { Vec3 } from './Vec3';

export type Plane = [number, number, number, number];

export function inFrustum(
  planes: Plane[],
  center: Vec3,
  radius: number,
): boolean {
  for (const [a, b, c, d] of planes) {
    if (a * center.x + b * center.y + c * center.z + d < -radius) return false;
  }
  return true;
}
