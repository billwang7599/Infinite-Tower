/**
 * Raw mouse / trackpad state. Click the canvas to capture it (pointer lock), Esc releases it.
 * Optional: everything also works keyboard-only. Movement and buttons only count while captured.
 */
export class Mouse {
  private readonly down = new Set<number>();
  private readonly pressed = new Set<number>();
  private dx = 0;
  private dy = 0;
  locked = false;
  /** Only capture the mouse when the current mode wants it (the arena). */
  canLock = true;

  constructor(canvas: HTMLCanvasElement) {
    canvas.addEventListener("click", () => {
      if (!this.locked && this.canLock) void canvas.requestPointerLock?.();
    });
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.down.clear();
    });
    canvas.addEventListener("mousedown", (e) => {
      if (!this.locked) return;
      this.down.add(e.button);
      this.pressed.add(e.button);
    });
    window.addEventListener("mouseup", (e) => this.down.delete(e.button));
    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.dx += e.movementX;
      this.dy += e.movementY;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("auxclick", (e) => e.preventDefault());
  }

  release(): void {
    if (this.locked) document.exitPointerLock();
    this.down.clear();
    this.pressed.clear();
  }

  isDown(...buttons: readonly number[]): boolean {
    return buttons.some((b) => this.down.has(b));
  }

  consumePressed(...buttons: readonly number[]): boolean {
    let any = false;
    for (const b of buttons) if (this.pressed.delete(b)) any = true;
    return any;
  }

  /** Mouse movement since the last call, in pixels. */
  consumeDelta(): { dx: number; dy: number } {
    const d = { dx: this.dx, dy: this.dy };
    this.dx = this.dy = 0;
    return d;
  }
}
