/**
 * A keyboard-first menu list for UI screens: W/S or arrows move, Enter / Space / J choose. Hover and click
 * work too. The screen owns the keydown listener and forwards codes to `key()`, so only one screen
 * reacts at a time.
 */

/** Menu bindings (KeyboardEvent.code). J and K mirror the arena's attack / dodge hand position. */
export const MENU_KEYS = {
  up: ["KeyW", "ArrowUp"],
  down: ["KeyS", "ArrowDown"],
  choose: ["Enter", "Space", "KeyJ"],
  back: ["Escape", "Backspace", "KeyK"],
} as const satisfies Record<string, readonly string[]>;

export interface MenuItem {
  label: string;
  choose(): void;
}

const ITEM = "group flex cursor-pointer items-center gap-3 py-1 font-title text-[28px] tracking-[0.12em] "
  + "text-white/45 outline-none transition-colors duration-150 data-selected:text-white";
const MARKER = "text-sm text-victory opacity-0 transition-opacity duration-150 group-data-selected:opacity-100";

export class Menu {
  readonly el: HTMLElement;
  private readonly buttons: HTMLButtonElement[];
  private index = 0;

  constructor(private readonly items: MenuItem[]) {
    this.el = document.createElement("nav");
    this.el.className = "flex flex-col items-start";
    this.buttons = items.map((item, i) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = ITEM;
      button.innerHTML = `<span class="${MARKER}">◆</span><span data-label></span>`;
      // Keep focus off the buttons: keys go through `key()`, not the browser's button activation.
      button.addEventListener("mousedown", (e) => e.preventDefault());
      button.addEventListener("mouseenter", () => this.select(i));
      button.addEventListener("click", () => { this.select(i); item.choose(); });
      this.el.append(button);
      return button;
    });
    items.forEach((item, i) => this.setLabel(i, item.label));
    this.select(0);
  }

  setLabel(i: number, label: string): void {
    this.buttons[i]!.querySelector("[data-label]")!.textContent = label;
  }

  /** Handle a key press; true if the menu used it. */
  key(code: string, repeat: boolean): boolean {
    const n = this.items.length;
    if (has(MENU_KEYS.up, code)) this.select((this.index - 1 + n) % n);
    else if (has(MENU_KEYS.down, code)) this.select((this.index + 1) % n);
    else if (has(MENU_KEYS.choose, code)) { if (!repeat) this.items[this.index]!.choose(); }
    else return false;
    return true;
  }

  private select(i: number): void {
    this.index = i;
    this.buttons.forEach((b, j) => b.toggleAttribute("data-selected", j === i));
  }
}

export function has(keys: readonly string[], code: string): boolean {
  return keys.includes(code);
}
