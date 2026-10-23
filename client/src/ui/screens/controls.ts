/**
 * The controls page, built from the real binding tables (field/input.ts, battle/keys.ts), so it can never
 * disagree with the game. Change a binding there and this page follows.
 */
import { BUTTONS, KEYS } from "../../battle/keys.js";
import { FIELD_KEYS } from "../../field/input.js";

const KEY_NAMES: Record<string, string> = {
  Semicolon: ";", Escape: "Esc", Backspace: "⌫", ShiftLeft: "Shift", ShiftRight: "Shift",
  ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
};
const MOUSE_NAMES = ["Left click", "Middle click", "Right click"];

/** KeyboardEvent.code -> what's printed on the key. */
export function keyName(code: string): string {
  return KEY_NAMES[code] ?? code.replace(/^(Key|Digit)/, "");
}

/** Keys shown together as one way to do an action (W A S D), or a single key. */
type Combo = string[];

interface Row {
  action: string;
  keys: Combo[];
  mouse?: string;
}

/** Same index across the lists = one combo: combos([H, ←], [L, →]) -> "H L" or "← →". Duplicates merge. */
function combos(...lists: readonly (readonly string[])[]): Combo[] {
  const n = Math.min(...lists.map((l) => l.length));
  const all = Array.from({ length: n }, (_, i) => lists.map((l) => keyName(l[i]!)));
  return all.filter((c, i) => all.findIndex((d) => d.join() === c.join()) === i);
}

const mouse = (buttons: readonly number[]) => buttons.map((b) => MOUSE_NAMES[b]).join(" / ");

const SECTIONS: { title: string; rows: Row[]; note: string }[] = [
  {
    title: "Field",
    rows: [{ action: "Walk", keys: combos(FIELD_KEYS.up, FIELD_KEYS.left, FIELD_KEYS.down, FIELD_KEYS.right) }],
    note: "Touch a boar, or walk through the tall grass, to start a fight.",
  },
  {
    title: "Arena",
    rows: [
      { action: "Move", keys: combos(KEYS.forward, KEYS.left, KEYS.back, KEYS.right) },
      { action: "Jump", keys: combos(KEYS.jump) },
      { action: "Attack", keys: combos(KEYS.attack), mouse: mouse(BUTTONS.attack) },
      { action: "Dodge roll", keys: combos(KEYS.dodge), mouse: mouse(BUTTONS.dodge) },
      { action: "Lock on", keys: combos(KEYS.lockOn), mouse: mouse(BUTTONS.lockOn) },
      { action: "Turn camera", keys: combos(KEYS.turnLeft, KEYS.turnRight), mouse: "Move left / right" },
      { action: "Look up / down", keys: combos(KEYS.lookUp, KEYS.lookDown), mouse: "Move up / down" },
      { action: "Leave a finished fight", keys: combos(KEYS.leave) },
    ],
    note: "Click the arena to use the mouse or trackpad (tap = left click, two-finger tap = right click). "
      + "Esc lets go of it. Turning the camera yourself drops the lock-on.",
  },
];

const keycaps = (combo: Combo) =>
  `<span class="inline-flex gap-1">${combo.map((k) => `<kbd class="keycap">${k}</kbd>`).join("")}</span>`;

function rowHtml(row: Row): string {
  const keys = row.keys.map(keycaps).join(`<span class="mx-2 text-xs text-white/35">or</span>`);
  return `
    <span class="text-white/80">${row.action}</span>
    <span class="flex flex-wrap items-center">${keys}</span>
    <span class="text-xs text-white/55">${row.mouse ?? ""}</span>`;
}

/** The page body: one table per mode. */
export function controlsHtml(): string {
  return SECTIONS.map((section) => `
    <section class="mt-5 first:mt-0">
      <h3 class="mb-2 font-title text-lg tracking-[0.15em] text-victory">${section.title}</h3>
      <div class="grid grid-cols-[10rem_17rem_9rem] items-center gap-y-1.5 text-sm">
        <span></span>
        <span class="text-[11px] tracking-[0.2em] text-white/40 uppercase">Keyboard</span>
        <span class="text-[11px] tracking-[0.2em] text-white/40 uppercase">${section.rows.some((r) => r.mouse) ? "Mouse" : ""}</span>
        ${section.rows.map(rowHtml).join("")}
      </div>
      <p class="mt-2.5 max-w-[36rem] text-xs leading-relaxed text-white/50">${section.note}</p>
    </section>`).join("");
}
