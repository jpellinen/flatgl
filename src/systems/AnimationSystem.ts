import { System } from '@/core/System';
import { World } from '@/core/World';
import { Skeleton } from '@/components/Skeleton';
import { Animator } from '@/components/Animator';
import { Mat4 } from '@/math/Mat4';

// Returns the bracketing keyframe indices and interpolation alpha for time t.
function sampleTime(
  t: number,
  times: Float32Array,
): { lo: number; hi: number; alpha: number } {
  const n = times.length;
  if (n === 0 || t <= times[0]) return { lo: 0, hi: 0, alpha: 0 };
  if (t >= times[n - 1]) return { lo: n - 1, hi: n - 1, alpha: 0 };
  let lo = 0,
    hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid;
  }
  return { lo, hi, alpha: (t - times[lo]) / (times[hi] - times[lo]) };
}

function lerp3(
  out: Float32Array,
  outOff: number,
  vals: Float32Array,
  loOff: number,
  hiOff: number,
  a: number,
): void {
  out[outOff] = vals[loOff] + a * (vals[hiOff] - vals[loOff]);
  out[outOff + 1] = vals[loOff + 1] + a * (vals[hiOff + 1] - vals[loOff + 1]);
  out[outOff + 2] = vals[loOff + 2] + a * (vals[hiOff + 2] - vals[loOff + 2]);
}

function slerp4(
  out: Float32Array,
  outOff: number,
  vals: Float32Array,
  loOff: number,
  hiOff: number,
  t: number,
): void {
  const ax = vals[loOff],
    ay = vals[loOff + 1],
    az = vals[loOff + 2],
    aw = vals[loOff + 3];
  let bx = vals[hiOff],
    by = vals[hiOff + 1],
    bz = vals[hiOff + 2],
    bw = vals[hiOff + 3];
  let dot = ax * bx + ay * by + az * bz + aw * bw;
  if (dot < 0) {
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
    dot = -dot;
  }
  if (dot > 0.9999) {
    const rx = ax + t * (bx - ax);
    const ry = ay + t * (by - ay);
    const rz = az + t * (bz - az);
    const rw = aw + t * (bw - aw);
    const len = Math.sqrt(rx * rx + ry * ry + rz * rz + rw * rw);
    out[outOff] = rx / len;
    out[outOff + 1] = ry / len;
    out[outOff + 2] = rz / len;
    out[outOff + 3] = rw / len;
    return;
  }
  const theta = Math.acos(dot);
  const sinTheta = Math.sin(theta);
  const s0 = Math.sin((1 - t) * theta) / sinTheta;
  const s1 = Math.sin(t * theta) / sinTheta;
  out[outOff] = s0 * ax + s1 * bx;
  out[outOff + 1] = s0 * ay + s1 * by;
  out[outOff + 2] = s0 * az + s1 * bz;
  out[outOff + 3] = s0 * aw + s1 * bw;
}

export class AnimationSystem implements System {
  private readonly localScratch = new Float32Array(16);
  private readonly mulScratch = new Float32Array(16);

  constructor(private world: World) {}

  update(dt: number): void {
    for (const entity of this.world.query(Skeleton, Animator)) {
      const skeleton = this.world.get(entity, Skeleton)!;
      const animator = this.world.get(entity, Animator)!;
      const clip = animator.activeClip;
      if (!clip || clip.duration <= 0) continue;

      // Advance time
      animator.time += dt * animator.speed;
      if (animator.loop) {
        animator.time = animator.time % clip.duration;
      } else {
        animator.time = Math.min(animator.time, clip.duration);
      }

      // Evaluate tracks — write sampled values into skeleton local arrays
      for (const track of clip.tracks) {
        const { jointIndex: j, path, times, values } = track;
        const { lo, hi, alpha } = sampleTime(animator.time, times);
        if (path === 'translation') {
          lerp3(
            skeleton.localTranslations,
            j * 3,
            values,
            lo * 3,
            hi * 3,
            alpha,
          );
        } else if (path === 'scale') {
          lerp3(skeleton.localScales, j * 3, values, lo * 3, hi * 3, alpha);
        } else {
          slerp4(skeleton.localRotations, j * 4, values, lo * 4, hi * 4, alpha);
        }
      }

      // Forward pass — iterate in topological order so parents are always computed first.
      const worldMats = skeleton.worldMats;
      const ibm = skeleton.inverseBindMatrices;
      const lt = skeleton.localTranslations;
      const lr = skeleton.localRotations;
      const ls = skeleton.localScales;
      const localScratch = this.localScratch;
      const mulScratch = this.mulScratch;

      for (let oi = 0; oi < skeleton.jointCount; oi++) {
        const j = skeleton.topoOrder[oi];
        const jo = j * 16;

        Mat4.fromTRSInto(
          localScratch,
          lt[j * 3],
          lt[j * 3 + 1],
          lt[j * 3 + 2],
          lr[j * 4],
          lr[j * 4 + 1],
          lr[j * 4 + 2],
          lr[j * 4 + 3],
          ls[j * 3],
          ls[j * 3 + 1],
          ls[j * 3 + 2],
        );

        const p = skeleton.parentIndices[j];
        if (p >= 0) {
          Mat4.multiplyInto(mulScratch, worldMats, p * 16, localScratch, 0);
          worldMats.set(mulScratch, jo);
        } else {
          worldMats.set(localScratch, jo);
        }

        Mat4.multiplyInto(mulScratch, worldMats, jo, ibm, jo);
        skeleton.jointMatrices.set(mulScratch, jo);
      }
    }
  }
}
