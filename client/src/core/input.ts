/**
 * Raw keyboard / mouse state. The input system turns this into PlayerInput components each tick.
 * Presses are also latched, so a tap shorter than one physics tick is never lost.
 */
export class Keyboard {
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();

  constructor(target: Window = window) {
    target.addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    target.addEventListener("keyup", (e) => this.down.delete(e.code));
    // Avoid stuck keys when the tab loses focus.
    target.addEventListener("blur", () => this.down.clear());
  }

  isDown(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  /** True if any of the keys was pressed since the last call (clears those latches). */
  consumePressed(...codes: string[]): boolean {
    let any = false;
    for (const c of codes) if (this.pressed.delete(c)) any = true;
    return any;
  }

  clearPressed(): void {
    this.pressed.clear();
  }

  axis(negative: string[], positive: string[]): number {
    return (this.isDown(...positive) ? 1 : 0) - (this.isDown(...negative) ? 1 : 0);
  }
}

/** Click the canvas to capture the mouse (pointer lock); Esc releases it. Buttons only count while captured. */
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
  }

  release(): void {
    if (this.locked) document.exitPointerLock();
    this.down.clear();
    this.pressed.clear();
  }

  isDown(button: number): boolean {
    return this.down.has(button);
  }

  consumePressed(button: number): boolean {
    return this.pressed.delete(button);
  }

  /** Mouse movement since the last call, in pixels. */
  consumeDelta(): { dx: number; dy: number } {
    const d = { dx: this.dx, dy: this.dy };
    this.dx = this.dy = 0;
    return d;
  }
}
