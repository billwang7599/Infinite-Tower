export const TICK_RATE = 60;
export const FIXED_DT = 1 / TICK_RATE;

export const GRAVITY = -24;

export const PLAYER = {
  moveSpeed: 7,
  /** Velocity change per second toward target speed. */
  accel: 60,
  airAccel: 30,
  jumpSpeed: 12, // apex = v²/2g = 3.0 > floorHeight
  coyoteTime: 0.1,
  jumpBuffer: 0.12,
  /** Release jump early to cut the arc. */
  jumpCutMultiplier: 0.5,
  radius: 0.35,
  height: 1.4,
} as const;

export const TOWER = {
  floorHeight: 2.4,
  /** Half-size of the tower's interior (x and z). */
  halfWidth: 7,
  /** Floors kept generated above the player's best floor. */
  floorsAhead: 12,
} as const;
