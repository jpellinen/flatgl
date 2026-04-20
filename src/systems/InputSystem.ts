import { System } from '@/core/System';
import { Camera } from '@/components/Camera';
import { Vec3 } from '@/math/Vec3';

import { ORBIT_SENSITIVITY, ORBIT_PITCH_CLAMP } from '@/config';

export class InputSystem implements System {
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private dx = 0;
  private dy = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: Camera,
  ) {
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(_dt: number): void {
    if (this.dx === 0 && this.dy === 0) return;

    const sensitivity = ORBIT_SENSITIVITY;
    const dYaw = this.dx * sensitivity;
    const dPitch = this.dy * sensitivity;
    this.dx = 0;
    this.dy = 0;

    const { camera } = this;
    const offset = camera.position.sub(camera.target);
    const r = offset.length();

    // Spherical coordinates relative to target
    const theta = Math.atan2(offset.x, offset.z);
    const phi = Math.asin(Math.max(-1, Math.min(1, offset.y / r)));

    const newTheta = theta - dYaw;
    const newPhi = Math.max(
      -Math.PI / 2 + ORBIT_PITCH_CLAMP,
      Math.min(Math.PI / 2 - ORBIT_PITCH_CLAMP, phi + dPitch),
    );

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
  }
}
