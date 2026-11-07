/** Most keys one action can be bound to: the settings screen and the server's check agree on it. */
export const MAX_KEYS_PER_ACTION = 3;
/** The overworld camera looks north, east, south or west, saved as quarter turns right from north. */
export const OVERWORLD_CAMERA_ANGLES = 4;

/** The settings screen's sliders; the server refuses a saved value off them. */
export const CAMERA_SENSITIVITY = { min: 0.25, max: 3, step: 0.05, default: 1 } as const;
export const FLICK_SENSITIVITY = { min: 0.5, max: 2, step: 0.05, default: 1 } as const;
