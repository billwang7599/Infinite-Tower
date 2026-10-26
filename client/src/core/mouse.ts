/**
 * Mouse / trackpad, by MouseEvent.button. Click the canvas to capture it (pointer lock), Esc releases it. With
 * the Auto mouse lock setting on it's also captured, without a click, the moment the arena wants it.
 * Optional: everything also works keyboard-only. Movement and buttons only count while captured.
 */
import { Buttons } from "./buttons.js";

export interface LockChange {
  /** Whether the current mode wanted the mouse before this change, and now. */
  wasLockable: boolean;
  lockable: boolean;
  /** The Auto mouse lock setting. */
  autoLock: boolean;
  locked: boolean;
}

/**
 * Capture the mouse without a click only at the moment it becomes wanted (a battle starts, or a screen over the
 * arena closes). So a lock let go with Esc mid-fight stays let go until the player clicks.
 */
export function shouldAutoLock({ wasLockable, lockable, autoLock, locked }: LockChange): boolean {
  return autoLock && lockable && !wasLockable && !locked;
}

export class Mouse extends Buttons<number> {
  private dx = 0;
  private dy = 0;
  locked = false;
  /** Only capture the mouse when the current mode wants it (the arena). */
  private lockable = true;

  constructor(
    private readonly canvas: HTMLCanvasElement, private readonly doc: Document = document, win: Window = window,
  ) {
    super();
    canvas.addEventListener("click", () => {
      if (!this.locked && this.lockable) void this.lock();
    });
    doc.addEventListener("pointerlockchange", () => {
      this.locked = doc.pointerLockElement === canvas;
      if (!this.locked) this.releaseAll();
      // A request answered after the arena stopped wanting the mouse.
      else if (!this.lockable) doc.exitPointerLock();
    });
    canvas.addEventListener("mousedown", (e) => {
      if (this.locked) this.press(e.button);
    });
    win.addEventListener("mouseup", (e) => this.release(e.button));
    doc.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.dx += e.movementX;
      this.dy += e.movementY;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("auxclick", (e) => e.preventDefault());
  }

  /**
   * Whether the current mode wants the mouse. Not any more: let go of it. Wanted from now on: capture it at
   * once if `autoLock` (the setting) says so.
   */
  setLockable(lockable: boolean, autoLock: boolean): void {
    const wasLockable = this.lockable;
    this.lockable = lockable;
    if (shouldAutoLock({ wasLockable, lockable, autoLock, locked: this.locked })) void this.lock();
    if (!lockable) this.unlock();
  }

  /**
   * Ask for the pointer lock. Never rejects: a browser may refuse one without a recent click or key press (or
   * right after the player let go with Esc), and then a click on the canvas asks again.
   */
  async lock(): Promise<void> {
    try {
      await this.canvas.requestPointerLock?.();
    } catch {
      // Refused: stay unlocked.
    }
  }

  /** Let go of the pointer lock (leaving the arena) and forget all buttons. */
  unlock(): void {
    if (this.locked) this.doc.exitPointerLock();
    this.releaseAll(true);
  }

  /** Mouse movement since the last call, in pixels. */
  consumeDelta(): { dx: number; dy: number } {
    const d = { dx: this.dx, dy: this.dy };
    this.dx = this.dy = 0;
    return d;
  }
}
