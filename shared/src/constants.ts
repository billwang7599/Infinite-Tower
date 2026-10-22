export const TICK_RATE = 60;
export const FIXED_DT = 1 / TICK_RATE;

export const GRAVITY = -24;

/** Yaw convention everywhere: yaw 0 faces +z, forward = (sin yaw, cos yaw), right = (cos yaw, -sin yaw). */

export const PLAYER = {
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
  maxStamina: 100,
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

export const BOAR = {
  maxHp: 160,
  radius: 0.85,
  mass: 20,
  walkSpeed: 3.2,
  turnRate: 3.0, // rad/s
  /** Poise breaks after enough hits in quick succession -> stagger. */
  poise: 36,
  poiseRegen: 8,
  staggerTime: 1.0,

  gore: {
    trigger: 2.8, // start the attack within this center distance
    range: 2.6,
    minDot: 0.35,
    windup: 0.65,
    active: 0.18,
    recover: 0.75,
    lunge: 6,
    damage: 16,
    knockback: 8,
    lift: 3,
    cooldown: 0.6,
  },
  charge: {
    minDist: 5,
    maxDist: 22,
    windup: 1.1,
    /** Stops tracking the player this long before the charge starts: your cue to dodge. */
    lockAt: 0.3,
    speed: 17,
    maxTime: 1.6,
    range: 1.9,
    minDot: 0.2,
    damage: 30,
    knockback: 15,
    lift: 6,
    recover: 0.9,
    /** Stunned this long after slamming into the arena wall. */
    stun: 2.2,
    cooldown: 4.5,
  },
} as const;

export const ARENA = {
  radius: 16,
} as const;
