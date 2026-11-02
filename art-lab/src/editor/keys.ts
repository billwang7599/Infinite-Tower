import type { ToolName } from "./state.js";

export type Command =
  | { do: "undo" | "redo" | "save" | "copy" | "cut" | "paste" | "clear" | "selectAll" | "deselect" | "underlay" }
  | { do: "zoom"; by: 1 | -1 }
  | { do: "nudge"; dx: number; dy: number }
  | { do: "tool"; tool: ToolName };

type KeyPress = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">;

const WITH_CTRL: Record<string, Command["do"]> = {
  z: "undo", y: "redo", s: "save", c: "copy", x: "cut", v: "paste", a: "selectAll", d: "deselect",
};
export const TOOL_KEYS: Record<string, ToolName> = {
  b: "pencil", e: "eraser", g: "fill", l: "line", u: "rect", m: "select", i: "picker",
};
const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
};
const BIG_NUDGE_PX = 8;

export function commandFor(e: KeyPress): Command | null {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (e.ctrlKey || e.metaKey) {
    const command = WITH_CTRL[key];
    if (command === "undo" && e.shiftKey) return { do: "redo" };
    return command ? { do: command } as Command : null;
  }
  if (e.altKey) return null;
  const tool = TOOL_KEYS[key];
  if (tool) return { do: "tool", tool };
  const arrow = ARROWS[key];
  if (arrow) {
    const by = e.shiftKey ? BIG_NUDGE_PX : 1;
    return { do: "nudge", dx: arrow[0] * by, dy: arrow[1] * by };
  }
  if (key === "+" || key === "=") return { do: "zoom", by: 1 };
  if (key === "-" || key === "_") return { do: "zoom", by: -1 };
  if (key === "Delete" || key === "Backspace") return { do: "clear" };
  if (key === "Escape") return { do: "deselect" };
  if (key === "h") return { do: "underlay" };
  return null;
}

const NOT_TYPED = new Set(["checkbox", "radio", "range", "button", "submit", "reset", "color", "file"]);

export function typingIn(target: { tagName: string; type?: string; isContentEditable?: boolean } | null): boolean {
  if (!target) return false;
  if (target.isContentEditable || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return true;
  return target.tagName === "INPUT" && !NOT_TYPED.has(target.type ?? "text");
}
