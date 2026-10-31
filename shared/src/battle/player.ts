/** Player tuning for the arena, at stats of 10 (stats.ts). Units: seconds, meters, m/s and m/s². */

/** For everything in the arena. Tuned together with `PLAYER.jumpSpeed`. */
export const GRAVITY = -24;

export const PLAYER = {
  /** At agility 10. */
  moveSpeed: 6,
  /** Velocity change per second toward target speed. */
  accel: 60,
  airAccel: 25,
  jumpSpeed: 8.5,
  coyoteTime: 0.1,
  jumpBuffer: 0.12,
  /** Release jump early to cut the arc. */
  jumpCutMultiplier: 0.5,
  radius: 0.35,
  height: 1.4,

  maxHp: 100,
  staminaRegenPerSec: 45,
  /** Stamina starts refilling this long after an action ends. */
  staminaRegenDelay: 0.6,
  /** Presses this early still count (queue the next attack / dodge). */
  inputBuffer: 0.2,
  hurtInvuln: 0.6,
  /** From the center to the hilt: a weapon's length goes on from there. */
  armReachM: 0.8,

  dodge: {
    cost: 22,
    duration: 0.42,
    /** From the dodge's first step: a dodge on the step a hit lands beats it. */
    iframeStart: 0,
    iframeEnd: 0.32,
    speed: 12,
    endSpeed: 3,
  },
} as const;

/** Carried from one fight to the next; max stamina is `Stats.stamina`. */
export interface Vitals {
  hp: number;
  stamina: number;
}
