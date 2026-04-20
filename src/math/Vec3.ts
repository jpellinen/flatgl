export class Vec3 {
  constructor(readonly x: number, readonly y: number, readonly z: number) {}

  add(b: Vec3): Vec3 { return new Vec3(this.x + b.x, this.y + b.y, this.z + b.z); }
  sub(b: Vec3): Vec3 { return new Vec3(this.x - b.x, this.y - b.y, this.z - b.z); }
  scale(s: number): Vec3 { return new Vec3(this.x * s, this.y * s, this.z * s); }
  dot(b: Vec3): number { return this.x * b.x + this.y * b.y + this.z * b.z; }
  length(): number { return Math.sqrt(this.dot(this)); }

  cross(b: Vec3): Vec3 {
    return new Vec3(
      this.y * b.z - this.z * b.y,
      this.z * b.x - this.x * b.z,
      this.x * b.y - this.y * b.x,
    );
  }

  normalize(): Vec3 {
    const len = this.length();
    return len > 0 ? this.scale(1 / len) : new Vec3(0, 0, 0);
  }
}
