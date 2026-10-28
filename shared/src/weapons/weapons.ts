import { FIXED_DT } from "../core/time.js";
import type { Hand } from "../items/gear.js";
import type { ItemId } from "../items/items.js";

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
const PERPENDICULAR: Record<SwingLine, SwingLine> = {
  horizontal: "vertical", vertical: "horizontal", falling: "rising", rising: "falling",
};

export const isSwing = (attack: AttackKind): attack is SwingDir => attack !== "stab";
export const lineOf = (dir: SwingDir): SwingLine => LINE[dir];
export const reverseOf = (dir: SwingDir): SwingDir => REVERSE[dir];

/** A weapon's moveset: its swings, chaining and look in motion. */
export const WEAPON_KINDS = ["sword"] as const;
export type WeaponKind = (typeof WEAPON_KINDS)[number];

export interface Weapon {
  kind: WeaponKind;
  /** The blade (m): every attack's reach grows with it. */
  length: number;
  /** At strength 10, before momentum. */
  damage: number;
  /** Swings start this many times faster (1: as CHAIN says). */
  speed: number;
}

export const WEAPONS = {
  sword: { kind: "sword", length: 1.1, damage: 9, speed: 1 },
  "kobold-blade": { kind: "sword", length: 1.1, damage: 14, speed: 1 },
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

/** How a swing follows the last one: not at all (an opening), back along its line, across it, or anything else. */
export type ChainKind = "opening" | "reverse" | "perpendicular" | "other";

export function chainKind(last: AttackKind | null, next: SwingDir): ChainKind {
  if (last === null || !isSwing(last)) return "opening";
  if (REVERSE[last] === next) return "reverse";
  return PERPENDICULAR[LINE[last]] === LINE[next] ? "perpendicular" : "other";
}

export const CHAIN = {
  /** From a swing's start to its blade going live, by how it follows the last one (at momentum 0). */
  startupTime: { opening: 0.1, reverse: 0.05, other: 0.1, perpendicular: 0.16 } satisfies Record<ChainKind, number>,
  stabStartupTime: 0.14,
  /** The blade is live this long, then the attack recovers for `recoverTime`. */
  activeTime: 0.1,
  recoverTime: 0.08,
  /** A chain lives on this long after an attack ends; the next swing then still chains. */
  gapTime: 0.25,
} as const;

/** How far into its attack the player may start the next one, or a dodge (pressed earlier, it waits). */
export const lettingGoAt = (startup: number): number => startup + CHAIN.activeTime;

export const MOMENTUM = {
  /** Gained by each chained swing, by how it follows the last. */
  gain: { opening: 0, reverse: 1, other: 0.5, perpendicular: 0.25 } satisfies Record<ChainKind, number>,
  max: 4,
  /** Each point: this much more damage (×2 at the most) and this much sooner a start (×0.6 at the most). */
  damagePerPoint: 0.25,
  maxDamage: 2,
  speedPerPoint: 0.1,
  /** A stab chained as a finisher spends the momentum: this much more damage per point. */
  stabBonusPerPoint: 0.5,
} as const;

export const momentumDamage = (momentum: number): number =>
  Math.min(MOMENTUM.maxDamage, 1 + momentum * MOMENTUM.damagePerPoint);

export function startupTime(kind: ChainKind, momentum: number, speed: number): number {
  const scale = 1 - Math.min(momentum, MOMENTUM.max) * MOMENTUM.speedPerPoint;
  return (CHAIN.startupTime[kind] * scale) / speed;
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
  /** The parried attacker is stunned this long, knocked back this far (m), and takes this much more damage. */
  stunTime: 1,
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
