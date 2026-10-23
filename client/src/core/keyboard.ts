/**
 * The keyboard, by KeyboardEvent.code (physical position, any layout). The whole game is playable
 * keyboard-only; see mouse.ts for the optional mouse. Bindings: battle/keys.ts, field/input.ts.
 */
import { Buttons } from "./buttons.js";

/** Keys the browser would otherwise use (scrolling). */
const SWALLOW = new Set(["Space", "Semicolon", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

export class Keyboard extends Buttons<string> {
  constructor(target: Window = window) {
    super();
    target.addEventListener("keydown", (e) => {
      if (SWALLOW.has(e.code)) e.preventDefault();
      this.press(e.code, e.repeat);
    });
    target.addEventListener("keyup", (e) => this.release(e.code));
    // Avoid stuck keys when the tab loses focus.
    target.addEventListener("blur", () => this.releaseAll());
  }

  /** -1, 0 or 1 from two sets of keys. */
  axis(negative: readonly string[], positive: readonly string[]): number {
    return (this.isDown(...positive) ? 1 : 0) - (this.isDown(...negative) ? 1 : 0);
  }
}
