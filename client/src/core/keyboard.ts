/** The keyboard, by KeyboardEvent.code (physical position, any layout). The whole game is playable with it alone. */
import { Buttons } from "./buttons.js";

/** Keys the browser would otherwise use (scrolling, moving focus, Firefox's quick find). */
const SWALLOW = new Set([
  "Space", "Semicolon", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab", "Quote", "Slash",
]);

export class Keyboard extends Buttons {
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

  /** Off (the default) while a screen has the keyboard: keys are left to the page, and held ones forgotten. */
  get enabled(): boolean {
    return this.on;
  }

  set enabled(on: boolean) {
    if (on === this.on) return;
    this.on = on;
    if (!on) this.releaseAll(true);
  }
}
