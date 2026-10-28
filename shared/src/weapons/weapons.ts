import { clamp } from "../core/math.js";
import { FIXED_DT } from "../core/time.js";
import type { Hand } from "../items/gear.js";
import { ITEMS, type ItemId } from "../items/items.js";

// Named by their way across the screen as the player sees it ("tlbr": top-left to bottom-right), an enemy's too, so
// a swing is parried by its reverse ("lr" by "rl"): the blades meet.
export const SWING_DIRS = ["lr", "rl", "tb", "bt", "tlbr", "brtl", "trbl", "bltr"] as const;
export type SwingDir = (typeof SWING_DIRS)[number];
export const ATTACK_KINDS = [...SWING_DIRS, "stab"] as const;
export type AttackKind = (typeof ATTACK_KINDS)[number];

type SwingLine = "horizontal" | "vertical" | "falling" | "rising";

const LINE: Record<SwingDir, SwingLine> = {
  lr: "horizontal", rl: "horizontal", tb: "vertical", bt: "vertical",
  tlbr: "falling", brtl: "falling", trbl: "rising", bltr: "rising",
};
const REVERSE: Record<SwingDir, SwingDir> = {
  lr: "rl", rl: "lr", tb: "bt", bt: "tb", tlbr: "brtl", brtl: "tlbr", trbl: "bltr", bltr: "trbl",
};

/** As the player sees it: x right, y up. */
export const SCREEN_DIR: Record<SwingDir, { x: number; y: number }> = {
  lr: { x: 1, y: 0 }, rl: { x: -1, y: 0 }, tb: { x: 0, y: -1 }, bt: { x: 0, y: 1 },
  tlbr: { x: Math.SQRT1_2, y: -Math.SQRT1_2 }, brtl: { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
  trbl: { x: -Math.SQRT1_2, y: -Math.SQRT1_2 }, bltr: { x: Math.SQRT1_2, y: Math.SQRT1_2 },
};

export const isSwing = (attack: AttackKind): attack is SwingDir => attack !== "stab";
export const lineOf = (dir: SwingDir): SwingLine => LINE[dir];
export const reverseOf = (dir: SwingDir): SwingDir => REVERSE[dir];

export const WEAPON_KINDS = ["sword"] as const;
export type WeaponKind = (typeof WEAPON_KINDS)[number];

export interface Weapon {
  kind: WeaponKind;
  /** The blade (m): every attack's reach grows with it. */
  length: number;
  mass: number;
  /** From the hand to its centre of mass (m). */
  balanceM: number;
  /** At the starter sword's momentum. */
  damage: number;
}

export const WEAPONS = {
  sword: { kind: "sword", length: 1.1, mass: ITEMS.sword.weight, balanceM: 0.25, damage: 9 },
  "kobold-blade": { kind: "sword", length: 1.1, mass: ITEMS["kobold-blade"].weight, balanceM: 0.25, damage: 14 },
} as const satisfies Partial<Record<ItemId, Weapon>>;
export type WeaponId = keyof typeof WEAPONS;

export const isWeapon = (item: ItemId | null): item is WeaponId => item !== null && Object.hasOwn(WEAPONS, item);

/** The right hand's first. */
export const weaponItemIn = (hands: Record<Hand, ItemId | null>): WeaponId | null =>
  isWeapon(hands.rightHand) ? hands.rightHand : isWeapon(hands.leftHand) ? hands.leftHand : null;

export function weaponIn(hands: Record<Hand, ItemId | null>): Weapon | null {
  const item = weaponItemIn(hands);
  return item && WEAPONS[item];
}

/**
 * Each line's hit shape: its reach as a share of arm plus blade, and its arc (degrees, all of it). Horizontal
 * swings are wide and short, vertical ones narrow and long; the stab is a ray `STAB_WIDTH` either side.
 */
const SHAPES: Record<SwingLine, { reachFactor: number; arcDeg: number }> = {
  horizontal: { reachFactor: 1, arcDeg: 160 },
  falling: { reachFactor: 1.15, arcDeg: 110 },
  rising: { reachFactor: 1.15, arcDeg: 110 },
  vertical: { reachFactor: 1.3, arcDeg: 60 },
};
const STAB_REACH_FACTOR = 1.75;
const STAB_WIDTH = 0.15;

/**
 * What an attack hits. An arc: targets whose surface is within `range` of the attacker's center, no more than the
 * angle `minDot` (a cosine) off the aim. A ray: within `width` of the line from the center `range` along the aim.
 */
export interface HitShape { shape: "arc" | "ray"; range: number; minDot: number; width: number }

export function attackShape(attack: AttackKind, armReachM: number, weapon: Pick<Weapon, "length">): HitShape {
  const reach = armReachM + weapon.length;
  if (!isSwing(attack)) return { shape: "ray", range: reach * STAB_REACH_FACTOR, minDot: 1, width: STAB_WIDTH };
  const { reachFactor, arcDeg } = SHAPES[LINE[attack]];
  return { shape: "arc", range: reach * reachFactor, minDot: Math.cos((arcDeg / 2) * (Math.PI / 180)), width: 0 };
}

/** The starter sword's at strength 10. */
export const SWING = {
  openingTime: 0.1,
  reverseTime: 0.05,
  stabTime: 0.14,
  /** The blade is live this long, then the attack recovers for `recoverTime`. */
  activeTime: 0.1,
  recoverTime: 0.08,
  gapTime: 0.25,
  maxFlow: 1.25,
  minTimeFactor: 0.5,
  maxTimeFactor: 2,
} as const;

/** In the screen plane: ±1 a swing's ends, 0 the guard; velocity per second. */
export interface Blade { x: number; y: number; vx: number; vy: number }
export const restingBlade = (): Blade => ({ x: 0, y: 0, vx: 0, vy: 0 });

// Solved so the starter sword at strength 10 takes `openingTime` from rest and `reverseTime` to reverse.
const ROOT_ACCEL = 2 / (SWING.openingTime - SWING.reverseTime / SWING.maxFlow);
const ACCEL = ROOT_ACCEL * ROOT_ACCEL;
const START_SPEED = (ACCEL * SWING.reverseTime) / SWING.maxFlow;
const FOLLOW_SPEED = START_SPEED * (SWING.maxFlow - 1);
const STARTER: Weapon = WEAPONS.sword;
const AVERAGE_STRENGTH = 10;

export interface SwingPlan {
  windupTime: number;
  timeFactor: number;
  flow: number;
  /** Against the starter sword's opening swing at strength 10, as is `effort` (energy added, braking too). */
  momentum: number;
  effort: number;
  blade: Blade;
}

/** Wind-up: 2√(d / a) + |Δv| / a to the swing's start; times × √((I / I0) / (strength / 10)), clamped. */
export function planSwing(weapon: Weapon, strength: number, blade: Blade, attack: AttackKind): SwingPlan {
  const inertiaOf = (w: Weapon): number => w.mass * w.balanceM * w.balanceM;
  const inertia = inertiaOf(weapon) / inertiaOf(STARTER);
  const rawTimeFactor = Math.sqrt(inertia / (strength / AVERAGE_STRENGTH));
  const timeFactor = clamp(rawTimeFactor, SWING.minTimeFactor, SWING.maxTimeFactor);
  const massRatio = weapon.mass / STARTER.mass;
  const speedFactor = Math.sqrt(Math.sqrt(strength / AVERAGE_STRENGTH)) / Math.sqrt(massRatio);
  // Too heavy to swing in the clamped time: the wielder pays for the speed it lacks.
  const lacking = Math.max(1, rawTimeFactor / timeFactor);
  const heft = inertia * speedFactor * speedFactor * lacking * lacking;
  const speed = Math.hypot(blade.vx, blade.vy);

  if (!isSwing(attack)) {
    const toRest = 2 * Math.sqrt(Math.hypot(blade.x, blade.y) / ACCEL) + speed / ACCEL;
    return {
      windupTime: Math.max(SWING.stabTime, toRest) * timeFactor, timeFactor, flow: 1, momentum: massRatio * speedFactor,
      effort: heft * (1 + (speed * speed) / (START_SPEED * START_SPEED)), blade: restingBlade(),
    };
  }
  const way = SCREEN_DIR[attack];
  const startSpeed = START_SPEED + Math.max(0, blade.vx * way.x + blade.vy * way.y);
  const dvx = way.x * startSpeed - blade.vx, dvy = way.y * startSpeed - blade.vy;
  const distance = Math.hypot(-way.x - blade.x, -way.y - blade.y), dv = Math.hypot(dvx, dvy);
  const flow = startSpeed / START_SPEED;
  return {
    windupTime: (2 * Math.sqrt(distance / ACCEL) + dv / ACCEL) * timeFactor, timeFactor, flow,
    momentum: massRatio * speedFactor * flow, effort: (heft * dv * dv) / (START_SPEED * START_SPEED),
    blade: { x: way.x, y: way.y, vx: way.x * FOLLOW_SPEED, vy: way.y * FOLLOW_SPEED },
  };
}

/** The step of an attack (0 is the step it starts on) its blade goes live on, for a start of `startup` seconds. */
export const liveStep = (startup: number): number => Math.round(startup / FIXED_DT);

/** The first step on which a clock counted up by FIXED_DT from 0 reaches `seconds` (as a state's clock does). */
export function stepsUntil(seconds: number): number {
  let t = 0, steps = 0;
  for (; t < seconds; steps++) t += FIXED_DT;
  return steps;
}

export const PARRY = {
  /** A swing is parried when the reverse swing's blade went live no more than this long before it lands. */
  window: 0.15,
  /** × the blades' momentum ratio, clamped. Knocked back this far (m), taking this much more damage. */
  stunTime: 1,
  minStunScale: 0.5,
  maxStunScale: 2,
  knockbackDist: 1.5,
  bonusDamage: 1.5,
  /** How fast (m/s²) the knocked-back attacker slides to a stop. */
  slideDecel: 30,
  /** A player parried by an enemy is staggered this long, knocked back at this speed (m/s). */
  playerStaggerTime: 0.5,
  playerKnockbackSpeed: 6,
  /** Only an attacker within this cosine of where the parrier faces can be parried. */
  minDot: 0.5,
} as const;
