/**
 * Mouse / trackpad, its buttons named by MouseEvent.button ("Mouse0" the left). While the game wants it (the overworld
 * and the arena with nothing over them) it's captured (pointer lock) by a press on the canvas, or by Auto mouse lock,
 * and let go with Esc, and counts only while captured; where it isn't wanted, it counts on the canvas as it is,
 * captured only while a camera drag lasts.
 */
import { clamp } from "@infinite-tower/shared";
import { Buttons } from "./buttons.js";

interface LockChange {
  /** Whether the current mode wanted the mouse before, and now. */
  wasLockable: boolean;
  lockable: boolean;
  autoLock: boolean;
  locked: boolean;
}

/**
 * Capture the mouse without a click only at the moment it becomes wanted (play starts, or a screen over the world
 * closes). So a lock lost some other way stays let go until the player clicks.
 */
export function shouldAutoLock({ wasLockable, lockable, autoLock, locked }: LockChange): boolean {
  return autoLock && lockable && !wasLockable && !locked;
}

type MoveListener = (dx: number, dy: number, atMs: number) => void;
type LockListener = (locked: boolean, byPlayer: boolean) => void;
/** Notches of a mouse wheel: + toward you. */
type WheelListener = (notches: number) => void;

const BUTTON_BITS = [1, 4, 2, 8, 16];
// A trackpad's scroll is a stream of small events, each its pixels' share of a notch (one event a notch at most); the
// first after a rest is a whole notch, as macOS sends a slow wheel's notch as a few pixels.
export const WHEEL = { notchPx: 100, linesPerNotch: 3, restMs: 150 } as const;

export class Mouse extends Buttons {
  private moved: MoveListener = () => {};
  private wheeled: WheelListener = () => {};
  private lockChanged: LockListener = () => {};
  private lastWheelMs = -Infinity;
  locked = false;
  /** Only capture the mouse when the current mode wants it. */
  private lockable = false;
  private rawMovement = false;
  private dragLockButtons: readonly string[] | null = null;
  private skipNextMove = false;

  constructor(
    private readonly canvas: HTMLCanvasElement, private readonly doc: Document = document, win: Window = window,
  ) {
    super();
    doc.addEventListener("pointerlockchange", () => {
      const was = this.locked;
      this.locked = doc.pointerLockElement === canvas;
      if (this.locked !== was) this.lockChanged(this.locked, !this.locked && this.lockable && doc.hasFocus());
      if (!this.locked) {
        this.dragLockButtons = null;
        this.releaseAll();
      } else if (this.dragLockButtons) {
        // A browser may report the jump into the lock as the first move after it.
        this.skipNextMove = true;
      } else if (!this.lockable) {
        // A request answered after the arena stopped wanting the mouse, or after the drag.
        doc.exitPointerLock();
      }
    });
    // Babylon's scene cancels every pointerdown, and then the browser sends no mousedown, mouseup or held mousemove.
    canvas.addEventListener("pointerdown", (e) => {
      this.button(e);
      if (!this.locked && this.lockable) void this.lock();
    });
    win.addEventListener("pointerup", (e) => this.button(e));
    doc.addEventListener("pointermove", (e) => {
      // A button pressed or let go while another is down.
      if (e.button >= 0) this.button(e);
      const skip = this.skipNextMove;
      this.skipNextMove = false;
      if (this.counts && !skip) this.moved(e.movementX, e.movementY, e.timeStamp);
    });
    canvas.addEventListener("wheel", (e) => {
      if (!this.counts || e.deltaY === 0) return;
      e.preventDefault();
      const notches = e.deltaMode === 0 ? e.deltaY / WHEEL.notchPx
        : e.deltaMode === 1 ? e.deltaY / WHEEL.linesPerNotch : Math.sign(e.deltaY);
      const rested = e.timeStamp - this.lastWheelMs >= WHEEL.restMs;
      this.lastWheelMs = e.timeStamp;
      this.wheeled(rested ? Math.sign(notches) : clamp(notches, -1, 1));
    }, { passive: false });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("auxclick", (e) => e.preventDefault());
  }

  private get counts(): boolean {
    return this.locked || !this.lockable;
  }

  private button(e: MouseEvent): void {
    const name = `Mouse${e.button}`;
    if ((e.buttons & (BUTTON_BITS[e.button] ?? 0)) !== 0) {
      if (this.counts) this.press(name);
      return;
    }
    this.release(name);
    if (this.dragLockButtons && !this.dragLockButtons.some((b) => this.held.has(b))) {
      this.dragLockButtons = null;
      if (this.locked) this.doc.exitPointerLock();
    }
  }

  onMove(listener: MoveListener): void {
    this.moved = listener;
  }

  onWheel(listener: WheelListener): void {
    this.wheeled = listener;
  }

  onLock(listener: LockListener): void {
    this.lockChanged = listener;
  }

  /** Whether the current mode wants the mouse: let go of it if not; newly wanted, captured at once if `autoLock`. */
  setLockable(lockable: boolean, autoLock: boolean, rawMovement = false): void {
    const wasLockable = this.lockable, rawChanged = rawMovement !== this.rawMovement;
    this.lockable = lockable;
    if (lockable) {
      this.dragLockButtons = null;
      this.rawMovement = rawMovement;
    }
    if (shouldAutoLock({ wasLockable, lockable, autoLock, locked: this.locked })) void this.lock();
    else if (lockable && this.locked && rawChanged) void this.lock();
    if (!lockable) this.unlock();
  }

  lockWhileHeld(buttons: readonly string[]): void {
    if (this.locked || this.lockable) return;
    this.dragLockButtons = buttons;
    this.rawMovement = true;
    void this.lock();
  }

  /** Never rejects: a browser may refuse without a recent click (then a press on the canvas asks again). */
  async lock(unadjustedMovement = this.rawMovement): Promise<void> {
    try {
      await this.canvas.requestPointerLock?.({ unadjustedMovement });
    } catch (e) {
      if (unadjustedMovement && e instanceof DOMException && e.name === "NotSupportedError") await this.lock(false);
    }
  }

  /** Lets go of the pointer lock and forgets all buttons. */
  unlock(): void {
    this.dragLockButtons = null;
    if (this.locked) this.doc.exitPointerLock();
    this.releaseAll(true);
  }
}
