import { Input } from '@/components/Input';
import { World } from '@/core/World';
import { System } from '@/core/System';

export class InputSystem implements System {
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private dx = 0;
  private dy = 0;
  private dZoom = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private world: World,
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

  update(): void {
    for (const entity of this.world.query(Input)) {
      const input = this.world.get(entity, Input)!;
      input.dx = this.dx;
      input.dy = this.dy;
      input.dZoom = this.dZoom;
      input.dragging = this.dragging;
    }
    this.dx = 0;
    this.dy = 0;
    this.dZoom = 0;
  }

  destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
  }
}
