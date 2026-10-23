/**
 * The keyboard, by KeyboardEvent.code (physical position, any layout). The whole game is playable
 * keyboard-only; see mouse.ts for the optional mouse. What each key does: settings/bindings.ts.
 */
import { Buttons } from "./buttons.js";

/** Keys the browser would otherwise use (scrolling, moving focus, Firefox's quick find). */
const SWALLOW = new Set(["Space", "Semicolon", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab", "Quote", "Slash"]);

export class Keyboard extends Buttons<string> {
  private on = false;

  constructor(target: Window = window) {
    super();
    target.addEventListener("keydown", (e) => {
      if (!this.on) return;
      if (SWALLOW.has(e.code)) e.preventDefault();
      this.press(e.code, e.repeat);
    });
    target.addEventListener("keyup", (e) => this.release(e.code));
    // Avoid stuck keys when the tab loses focus.
    target.addEventListener("blur", () => this.releaseAll());
  }

  /**
   * Off (the default) while the title or the settings screen has the keyboard: keys are ignored and left to
   * the page, and anything held or pressed is forgotten.
   */
  get enabled(): boolean {
    return this.on;
  }

  set enabled(on: boolean) {
    if (on === this.on) return;
    this.on = on;
    if (!on) this.releaseAll(true);
  }

  /** -1, 0 or 1 from two sets of keys. */
  axis(negative: readonly string[], positive: readonly string[]): number {
    return (this.isDown(...positive) ? 1 : 0) - (this.isDown(...negative) ? 1 : 0);
  }
}
