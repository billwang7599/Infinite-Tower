/**
 * Player tuning for the arena. Shared: the server's fight runs them, and so does the client's own copy of it.
 * Stats (strength, agility, stamina…) scale some of these: see stats.ts. Enemy stats and
 * arena size are server content (server/src/core/content).
 *
 * Units: seconds, meters, m/s and m/s², unless the name or comment says otherwise.
 */

/** m/s², for everything in the arena. Tuned together with `PLAYER.jumpSpeed`. */
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
  /** Presses this early still count (queue the next slash / dodge). */
  inputBuffer: 0.2,
  hurtInvuln: 0.6,

  slash: {
    cost: 16,
    windup: 0.09,
    active: 0.1,
    duration: 0.4,
    /** The next slash, or a dodge, may start this far into the current one (a dodge pressed before then waits). */
    chainAfter: 0.28,
    /** From the player's center to the target's surface. */
    range: 2.3,
    /** cos(70°): a 140° arc. */
    minDot: 0.34,
    /** At strength 10. */
    damage: 9,
    poiseDamage: 12,
    /** The swing carries you forward at this speed while its hitbox is live. */
    lungeSpeed: 4,
    /** Fraction of move speed allowed while swinging. */
    moveFactor: 0.25,
  },
  dodge: {
    cost: 22,
    duration: 0.42,
    /** From the dodge's first step: a dodge on the step a hit lands beats it (the user's call). */
    iframeStart: 0,
    iframeEnd: 0.32,
    speed: 12,
    endSpeed: 3,
  },
} as const;

/**
 * HP and stamina. They carry over from one fight to the next; the server holds them in between. Max stamina is
 * `Stats.stamina`.
 */
export interface Vitals {
  hp: number;
  stamina: number;
}
