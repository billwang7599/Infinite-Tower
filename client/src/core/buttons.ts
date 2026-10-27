/**
 * Held + pressed tracking for any kind of button (key codes, mouse buttons as "Mouse0"…). Presses are latched until
 * consumed, so a tap shorter than one fixed tick is never lost. Keyboard and Mouse feed it from DOM events.
 */

/** Counts presses on every Buttons, so the keyboard's and the mouse's can be put in order. */
let pressCount = 0;

export class Buttons {
  private readonly down = new Set<string>();
  /** Latched presses, each with its press count. */
  private readonly pressed = new Map<string, number>();

  /** True if any held button passes `which`. */
  isDown(which: (button: string) => boolean): boolean {
    for (const b of this.down) if (which(b)) return true;
    return false;
  }

  /** True if any button passing `which` was pressed since the last call (clears those latches). */
  consumePressed(which: (button: string) => boolean): boolean {
    let any = false;
    for (const b of this.pressed.keys()) if (which(b) && this.pressed.delete(b)) any = true;
    return any;
  }

  /** The latched presses, each with its count: a later press, on any Buttons, counts higher. */
  get presses(): ReadonlyMap<string, number> {
    return this.pressed;
  }

  clearPressed(): void {
    this.pressed.clear();
  }

  /** `repeat`: an auto-repeat event while held (counts as held, not as a new press). */
  protected press(b: string, repeat = false): void {
    if (!repeat) this.pressed.set(b, ++pressCount);
    this.down.add(b);
  }

  protected release(b: string): void {
    this.down.delete(b);
  }

  /** Forget everything held (focus lost, pointer unlocked), and optionally the latched presses too. */
  protected releaseAll(alsoPressed = false): void {
    this.down.clear();
    if (alsoPressed) this.pressed.clear();
  }
}
