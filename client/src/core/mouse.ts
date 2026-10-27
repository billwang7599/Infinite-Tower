/**
 * Mouse / trackpad, its buttons named by MouseEvent.button ("Mouse0" the left): captured (pointer lock) by a click on
 * the canvas, or by Auto mouse lock, and let go with Esc. Movement and buttons only count while captured.
 */
import { Buttons } from "./buttons.js";

interface LockChange {
  /** Whether the current mode wanted the mouse before, and now. */
  wasLockable: boolean;
  lockable: boolean;
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

export class Mouse extends Buttons {
  private dx = 0;
  private dy = 0;
  locked = false;
  /** Only capture the mouse when the current mode wants it (the arena). */
  private lockable = false;

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
      if (this.locked) this.press(`Mouse${e.button}`);
    });
    win.addEventListener("mouseup", (e) => this.release(`Mouse${e.button}`));
    doc.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.dx += e.movementX;
      this.dy += e.movementY;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("auxclick", (e) => e.preventDefault());
  }

  /** Whether the current mode wants the mouse: let go of it if not; newly wanted, captured at once if `autoLock`. */
  setLockable(lockable: boolean, autoLock: boolean): void {
    const wasLockable = this.lockable;
    this.lockable = lockable;
    if (shouldAutoLock({ wasLockable, lockable, autoLock, locked: this.locked })) void this.lock();
    if (!lockable) this.unlock();
  }

  /** Never rejects: a browser may refuse without a recent click (then a click on the canvas asks again). */
  async lock(): Promise<void> {
    try {
      await this.canvas.requestPointerLock?.();
    } catch {
      // Refused: stay unlocked.
    }
  }

  /** Lets go of the pointer lock and forgets all buttons. */
  unlock(): void {
    if (this.locked) this.doc.exitPointerLock();
    this.releaseAll(true);
  }

  /** Pixels moved since the last call. */
  consumeDelta(): { dx: number; dy: number } {
    const d = { dx: this.dx, dy: this.dy };
    this.dx = this.dy = 0;
    return d;
  }
}
