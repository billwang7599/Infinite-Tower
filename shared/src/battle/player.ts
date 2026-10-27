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

  /** Swings and the stab: how fast and how far they go is the sword's and the chain's (sword.ts). */
  swing: {
    cost: 16,
    poiseDamage: 12,
    /** The swing carries you forward at this speed while its blade is live. */
    lungeSpeed: 4,
    /** Fraction of move speed allowed while swinging. */
    moveFactor: 0.25,
  },
  stab: {
    cost: 20,
    /** Its damage is the sword's times this (and, chained as a finisher, the momentum's bonus: sword.ts). */
    damageFactor: 1.25,
    poiseDamage: 18,
    lungeSpeed: 4,
  },
  /** Held: stops what hits from in front for stamina. */
  block: {
    /** cos of half the guarded arc in front of the aim: 0.34 is 140°. */
    minDot: 0.34,
    /** A swing blocked still does this share of its damage; a stab or a body blow does none. */
    chipFraction: 0.2,
    /** Stamina a blocked hit costs, per point of its damage. Short of it, the guard breaks. */
    staminaPerDamage: 1,
    /** A blocked hit's knockback pushes the player back at this share of it. */
    pushbackFactor: 0.6,
    /** Staggered this long when the guard breaks. */
    guardBreakTime: 0.8,
    /** Fraction of move speed while blocking. */
    moveFactor: 0.4,
  },
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
