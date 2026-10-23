/**
 * Mouse / trackpad, by MouseEvent.button. Click the canvas to capture it (pointer lock), Esc releases it.
 * Optional: everything also works keyboard-only. Movement and buttons only count while captured.
 */
import { Buttons } from "./buttons.js";

export class Mouse extends Buttons<number> {
  private dx = 0;
  private dy = 0;
  locked = false;
  /** Only capture the mouse when the current mode wants it (the arena). */
  canLock = true;

  constructor(canvas: HTMLCanvasElement) {
    super();
    canvas.addEventListener("click", () => {
      if (!this.locked && this.canLock) void canvas.requestPointerLock?.();
    });
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.releaseAll();
    });
    canvas.addEventListener("mousedown", (e) => {
      if (this.locked) this.press(e.button);
    });
    window.addEventListener("mouseup", (e) => this.release(e.button));
    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.dx += e.movementX;
      this.dy += e.movementY;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("auxclick", (e) => e.preventDefault());
  }

  /** Let go of the pointer lock (leaving the arena) and forget all buttons. */
  unlock(): void {
    if (this.locked) document.exitPointerLock();
    this.releaseAll(true);
  }

  /** Mouse movement since the last call, in pixels. */
  consumeDelta(): { dx: number; dy: number } {
    const d = { dx: this.dx, dy: this.dy };
    this.dx = this.dy = 0;
    return d;
  }
}
