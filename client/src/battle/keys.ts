/**
 * Arena bindings. Two equal setups:
 * - keyboard only (laptop): left hand on WASD + Space, right hand on the home row (vim-style H/L turn the camera);
 * - keyboard + mouse / trackpad: mouse turns the camera, buttons below act.
 * Keys are KeyboardEvent.code, so they follow physical positions on any layout.
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

/** Mouse buttons (MouseEvent.button): 0 left, 1 middle (wheel click), 2 right. Trackpad: tap = left, two-finger tap = right. */
export const BUTTONS = {
  attack: [0],
  dodge: [2],
  lockOn: [1],
} as const satisfies Record<string, readonly number[]>;
