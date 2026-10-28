import { Buttons } from "./buttons.js";

// Returning true keeps the key from the page.
type KeyListener = (key: string, repeat: boolean) => boolean;

const inTextField = (target: EventTarget | null): boolean =>
  ["INPUT", "TEXTAREA"].includes((target as Partial<Element> | null)?.tagName ?? "");

// In a text field: the arrows, Esc, and the digits and Backspace (a skill's word search picks and undoes with them).
const TEXT_FIELD_KEYS = /^(Arrow|Escape$|Digit\d$|Backspace$)/;

export class Keyboard extends Buttons {
  private listener: KeyListener = () => false;
  private capture: ((key: string) => boolean) | null = null;

  constructor(target: Window = window) {
    super();
    target.addEventListener("keydown", (e) => this.keydown(e));
    target.addEventListener("keyup", (e) => this.release(e.code));
    // Avoid stuck keys when the tab loses focus.
    target.addEventListener("blur", () => this.releaseAll());
  }

  listen(listener: KeyListener): void {
    this.listener = listener;
  }

  captureKey(take: (key: string) => boolean): () => void {
    this.capture = take;
    return () => {
      if (this.capture === take) this.capture = null;
    };
  }

  private keydown(e: KeyboardEvent): void {
    const take = this.capture;
    if (take) {
      e.preventDefault();
      if (!e.repeat && take(e.code) && this.capture === take) this.capture = null;
      return;
    }
    if (inTextField(e.target) && !TEXT_FIELD_KEYS.test(e.code)) return;
    this.press(e.code, e.repeat);
    if (this.listener(e.code, e.repeat)) e.preventDefault();
  }
}
