import { Vec3 } from '@/math/Vec3';
import { Camera } from '@/components/Camera';
import { System } from '@/core/System';
import {
  AUTO_ROTATE_SPEED,
  ORBIT_PITCH_CLAMP,
  ORBIT_SENSITIVITY,
  ORBIT_ZOOM_MAX,
  ORBIT_ZOOM_MIN,
  ORBIT_ZOOM_SENSITIVITY,
} from '@/config';

export class InputSystem implements System {
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private dx = 0;
  private dy = 0;
  private dZoom = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: Camera,
  ) {
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: true });
  }

  private onDown = (e: PointerEvent): void => {
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.canvas.setPointerCapture(e.pointerId);
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    this.dx += e.clientX - this.lastX;
    this.dy += e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private onUp = (): void => {
    this.dragging = false;
  };

  private onWheel = (e: WheelEvent): void => {
    this.dZoom += e.deltaY;
  };

  update(dt: number): void {
    const { camera } = this;
    const offset = camera.position.sub(camera.target);
    let r = offset.length();
    const theta = Math.atan2(offset.x, offset.z);
    const phi = Math.asin(Math.max(-1, Math.min(1, offset.y / r)));

    // Zoom
    if (this.dZoom !== 0) {
      r = Math.max(ORBIT_ZOOM_MIN, Math.min(ORBIT_ZOOM_MAX, r + this.dZoom * ORBIT_ZOOM_SENSITIVITY * r));
      this.dZoom = 0;
    }

    // Orbit drag
    let newTheta = theta;
    let newPhi = phi;
    if (this.dx !== 0 || this.dy !== 0) {
      newTheta = theta - this.dx * ORBIT_SENSITIVITY;
      newPhi = Math.max(
        -Math.PI / 2 + ORBIT_PITCH_CLAMP,
        Math.min(Math.PI / 2 - ORBIT_PITCH_CLAMP, phi + this.dy * ORBIT_SENSITIVITY),
      );
      this.dx = 0;
      this.dy = 0;
    } else if (!this.dragging) {
      newTheta = theta - AUTO_ROTATE_SPEED * dt;
    }

    camera.position = camera.target.add(
      new Vec3(
        r * Math.cos(newPhi) * Math.sin(newTheta),
        r * Math.sin(newPhi),
        r * Math.cos(newPhi) * Math.cos(newTheta),
      ),
    );
  }

  destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
  }
}
