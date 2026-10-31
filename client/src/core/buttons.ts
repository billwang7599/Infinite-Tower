let pressCount = 0;
const nextPressOrder = (): number => ++pressCount;

export class Buttons {
  private readonly down = new Set<string>();
  // Latched until cleared, so a tap shorter than a tick is never lost.
  private readonly pressed = new Map<string, number>();

  get held(): ReadonlySet<string> {
    return this.down;
  }

  get presses(): ReadonlyMap<string, number> {
    return this.pressed;
  }

  clearPressed(): void {
    this.pressed.clear();
  }

  protected press(b: string, repeat = false): void {
    if (!repeat) this.pressed.set(b, nextPressOrder());
    this.down.add(b);
  }

  protected release(b: string): void {
    this.down.delete(b);
  }

  protected releaseAll(alsoPressed = false): void {
    this.down.clear();
    if (alsoPressed) this.pressed.clear();
  }
}
