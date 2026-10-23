/**
 * Held + pressed tracking for any kind of button (key codes, mouse buttons). Presses are latched until
 * consumed, so a tap shorter than one fixed tick is never lost. Keyboard and Mouse feed it from DOM events.
 */
export class Buttons<B> {
  private readonly down = new Set<B>();
  private readonly pressed = new Set<B>();

  isDown(...buttons: readonly B[]): boolean {
    return buttons.some((b) => this.down.has(b));
  }

  /** True if any of the buttons was pressed since the last call (clears those latches). */
  consumePressed(...buttons: readonly B[]): boolean {
    let any = false;
    for (const b of buttons) if (this.pressed.delete(b)) any = true;
    return any;
  }

  clearPressed(): void {
    this.pressed.clear();
  }

  /** `repeat`: an auto-repeat event while held (counts as held, not as a new press). */
  protected press(b: B, repeat = false): void {
    if (!repeat) this.pressed.add(b);
    this.down.add(b);
  }

  protected release(b: B): void {
    this.down.delete(b);
  }

  /** Forget everything held (focus lost, pointer unlocked), and optionally the latched presses too. */
  protected releaseAll(alsoPressed = false): void {
    this.down.clear();
    if (alsoPressed) this.pressed.clear();
  }
}
