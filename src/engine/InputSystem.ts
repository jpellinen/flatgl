import { Vec3 } from '../math/Vec3';
import { TopDownCamera } from './TopDownCamera';

export interface InputSnapshot {
  isDown(key: string): boolean;
  readonly keys: ReadonlySet<string>;
  readonly mousePixel: Readonly<{ x: number; y: number }>;
  readonly mouseWorld: Vec3;
  readonly mouseDown: boolean;
  readonly mouseHeld: boolean;
  readonly mouseUp: boolean;
}

class InputSnapshotImpl implements InputSnapshot {
  keys: ReadonlySet<string> = new Set();
  mousePixel: { x: number; y: number } = { x: 0, y: 0 };
  mouseWorld: Vec3 = new Vec3(0, 0, 0);
  mouseDown = false;
  mouseHeld = false;
  mouseUp = false;

  isDown(key: string): boolean {
    return (this.keys as Set<string>).has(key);
  }
}

export class EngineInputSystem {
  private _snapshot = new InputSnapshotImpl();
  private heldKeys = new Set<string>();
  private mouseIsDown = false;
  private mouseWasDown = false;
  private rawMousePixel = { x: 0, y: 0 };

  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onMouseMove: (e: MouseEvent) => void;
  private onMouseDown: (e: MouseEvent) => void;
  private onMouseUp: (e: MouseEvent) => void;

  constructor(private canvas: HTMLCanvasElement, private camera: TopDownCamera) {
    this.onKeyDown = (e: KeyboardEvent) => { this.heldKeys.add(e.key); };
    this.onKeyUp = (e: KeyboardEvent) => { this.heldKeys.delete(e.key); };
    this.onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.rawMousePixel = {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height),
      };
    };
    this.onMouseDown = (e: MouseEvent) => { if (e.button === 0) this.mouseIsDown = true; };
    this.onMouseUp   = (e: MouseEvent) => { if (e.button === 0) this.mouseIsDown = false; };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('mouseup', this.onMouseUp);
  }

  update(aspect: number): void {
    const snap = this._snapshot;

    snap.keys = new Set(this.heldKeys);
    snap.mousePixel = { ...this.rawMousePixel };
    snap.mouseDown = this.mouseIsDown && !this.mouseWasDown;
    snap.mouseHeld = this.mouseIsDown;
    snap.mouseUp = !this.mouseIsDown && this.mouseWasDown;
    this.mouseWasDown = this.mouseIsDown;
    snap.mouseWorld = this.unprojectToGround(this.rawMousePixel.x, this.rawMousePixel.y, aspect);
  }

  get snapshot(): InputSnapshot {
    return this._snapshot;
  }

  private unprojectToGround(px: number, py: number, aspect: number): Vec3 {
    const { width, height } = this.canvas;
    const ndcX = (px / width) * 2 - 1;
    const ndcY = 1 - (py / height) * 2;

    const vp = this.camera.projectionMatrix(aspect).multiply(this.camera.viewMatrix());
    const invVP = vp.invert();
    if (!invVP) return new Vec3(0, 0, 0);

    const nearPt = transformH(invVP, ndcX, ndcY, -1);
    const farPt  = transformH(invVP, ndcX, ndcY,  1);

    const dy = farPt.y - nearPt.y;
    if (Math.abs(dy) < 1e-6) return new Vec3(nearPt.x, 0, nearPt.z);
    const t = -nearPt.y / dy;
    return new Vec3(
      nearPt.x + t * (farPt.x - nearPt.x),
      0,
      nearPt.z + t * (farPt.z - nearPt.z),
    );
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('mouseup', this.onMouseUp);
  }
}

function transformH(m: import('../math/Mat4').Mat4, x: number, y: number, z: number): Vec3 {
  const a = m.array;
  const rx = a[0]*x + a[4]*y + a[8]*z + a[12];
  const ry = a[1]*x + a[5]*y + a[9]*z + a[13];
  const rz = a[2]*x + a[6]*y + a[10]*z + a[14];
  const rw = a[3]*x + a[7]*y + a[11]*z + a[15];
  return new Vec3(rx / rw, ry / rw, rz / rw);
}
