/**
 * Player tuning for the arena. Shared: the client predicts its own player with these and a server
 * would re-run them. Stats (strength, agility, stamina…) scale some of these: see stats.ts. Enemy stats and
 * arena size are server content (server/src/content).
 */
import type { Stats } from "./stats.js";

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
  staminaRegen: 45, // per second
  staminaDelay: 0.6, // seconds after an action before regen starts
  /** Presses this early still count (queue the next slash / dodge). */
  inputBuffer: 0.2,
  hurtInvuln: 0.6,

  slash: {
    cost: 16,
    windup: 0.09,
    active: 0.1,
    duration: 0.4,
    /** The next slash may start this far into the current one. */
    chainAfter: 0.28,
    range: 2.3, // from the player's center to the target's surface
    minDot: 0.34, // cos(70°): a 140° arc
    /** At strength 10. */
    damage: 9,
    poise: 12,
    lunge: 4,
    /** Fraction of move speed allowed while swinging. */
    moveFactor: 0.25,
  },
  dodge: {
    cost: 22,
    duration: 0.42,
    iframeStart: 0.03,
    iframeEnd: 0.32,
    speed: 12,
    endSpeed: 3,
  },
} as const;

/** HP and stamina. They carry over from one fight to the next; the server holds them in between. Max stamina is `Stats.stamina`. */
export interface Vitals {
  hp: number;
  stamina: number;
}

export const fullVitals = (stats: Stats): Vitals => ({ hp: PLAYER.maxHp, stamina: stats.stamina });
