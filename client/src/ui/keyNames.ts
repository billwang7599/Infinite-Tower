/** What to print for a KeyboardEvent.code or a MouseEvent.button. */
const KEY_NAMES: Record<string, string> = {
  Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", Backslash: "\\", Backquote: "`",
  BracketLeft: "[", BracketRight: "]", Minus: "-", Equal: "=",
  ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
  ShiftLeft: "Left Shift", ShiftRight: "Right Shift", ControlLeft: "Left Ctrl", ControlRight: "Right Ctrl",
  AltLeft: "Left Alt", AltRight: "Right Alt", CapsLock: "Caps Lock", Escape: "Esc",
};

export function keyName(code: string): string {
  return KEY_NAMES[code] ?? code.replace(/^(Key|Digit)/, "").replace(/^Numpad/, "Num ");
}

const MOUSE_NAMES = ["Left click", "Middle click", "Right click", "Back side button", "Forward side button"];

export function mouseName(button: number): string {
  return MOUSE_NAMES[button] ?? `Mouse ${button + 1}`;
}
