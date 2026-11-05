import { Buttons } from "./buttons.js";

// Returning true keeps the key from the page.
type KeyListener = (key: string, repeat: boolean) => boolean;

// A text field keeps its keys but the arrows, Esc, the digits and Backspace (a skill's word search picks and undoes
// with them), and Enter and Tab where it sends (the chat's: Tab takes a command's suggestion).
const TEXT_FIELD_KEYS = /^(Arrow|Escape$|Digit\d$|Backspace$)/;

function fieldKeeps(target: EventTarget | null, code: string): boolean {
  const field = target as Partial<HTMLInputElement> | null;
  if (!["INPUT", "TEXTAREA"].includes(field?.tagName ?? "")) return false;
  return !TEXT_FIELD_KEYS.test(code) && !(["Enter", "Tab"].includes(code) && field?.enterKeyHint === "send");
}

export class Keyboard extends Buttons {
  private listener: KeyListener = () => false;
  private released: (key: string) => void = () => {};
  private capture: ((key: string) => boolean) | null = null;

  constructor(target: Window = window) {
    super();
    target.addEventListener("keydown", (e) => this.keydown(e));
    target.addEventListener("keyup", (e) => {
      this.release(e.code);
      this.released(e.code);
    });
    // Avoid stuck keys when the tab loses focus.
    target.addEventListener("blur", () => this.releaseAll());
  }

  listen(listener: KeyListener): void {
    this.listener = listener;
  }

  onRelease(listener: (key: string) => void): void {
    this.released = listener;
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
    if (fieldKeeps(e.target, e.code)) return;
    this.press(e.code, e.repeat);
    if (this.listener(e.code, e.repeat)) e.preventDefault();
  }
}
