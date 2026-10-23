/**
 * Arena key bindings. Keyboard-only, laptop-friendly: left hand on WASD + Space,
 * right hand on the home row (vim-style H/L turn the camera left/right).
 * Values are KeyboardEvent.code, so they follow physical positions on any layout.
 */
export const KEYS = {
  forward: ["KeyW"],
  back: ["KeyS"],
  left: ["KeyA"],
  right: ["KeyD"],
  jump: ["Space"],
  attack: ["KeyJ"],
  dodge: ["KeyK", "ShiftLeft", "ShiftRight"],
  lockOn: ["Semicolon"],
  turnLeft: ["KeyH", "ArrowLeft"],
  turnRight: ["KeyL", "ArrowRight"],
  lookUp: ["ArrowUp"],
  lookDown: ["ArrowDown"],
} as const satisfies Record<string, readonly string[]>;
