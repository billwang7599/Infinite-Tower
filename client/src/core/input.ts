/**
 * Raw keyboard state (the whole game is playable keyboard-only; see mouse.ts for the optional mouse). The input system turns this into PlayerInput components each tick.
 * Presses are also latched, so a tap shorter than one physics tick is never lost.
 */
export class Keyboard {
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();

  constructor(target: Window = window) {
    target.addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.code.startsWith("Arrow") || e.code === "Semicolon") e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    target.addEventListener("keyup", (e) => this.down.delete(e.code));
    // Avoid stuck keys when the tab loses focus.
    target.addEventListener("blur", () => this.down.clear());
  }

  isDown(...codes: readonly string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  /** True if any of the keys was pressed since the last call (clears those latches). */
  consumePressed(...codes: readonly string[]): boolean {
    let any = false;
    for (const c of codes) if (this.pressed.delete(c)) any = true;
    return any;
  }

  clearPressed(): void {
    this.pressed.clear();
  }

  axis(negative: readonly string[], positive: readonly string[]): number {
    return (this.isDown(...positive) ? 1 : 0) - (this.isDown(...negative) ? 1 : 0);
  }
}
