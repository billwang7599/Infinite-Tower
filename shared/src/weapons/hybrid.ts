import { AVERAGE_STAT, physicalDamage, statFactor, type Stats } from "../battle/stats.js";
import { clamp } from "../core/math.js";
import { toSteps } from "../core/time.js";
import {
  scaleDamage, strengthDiscount, strengthTimeFactor, typedDamage, type AttackKind, type AttackSteps, type Damage,
  type Guard, type HitShape, type MeleeWeapon, type Weapon,
} from "./weapons.js";

// Named by their way across the screen as their swinger sees it ("tlbr": top left to bottom right), so a swing comes
// from its first letters' side; facing each other, one fighter's left is the other's right (`mirrorWay`).
export const SWING_DIRS = ["lr", "rl", "tb", "tlbr", "brtl", "trbl", "bltr"] as const;
export type SwingDir = (typeof SWING_DIRS)[number];
export const WAYS = [...SWING_DIRS, "stab"] as const;
export type Way = (typeof WAYS)[number];
export const STRIKES = ["light", "heavy", "stab"] as const;
export type Strike = (typeof STRIKES)[number];

type SwingLine = "horizontal" | "vertical" | "falling" | "rising";

const LINE: Record<SwingDir, SwingLine> = {
  lr: "horizontal", rl: "horizontal", tb: "vertical",
  tlbr: "falling", brtl: "falling", trbl: "rising", bltr: "rising",
};
const REVERSE: Partial<Record<SwingDir, SwingDir>> = {
  lr: "rl", rl: "lr", tlbr: "brtl", brtl: "tlbr", trbl: "bltr", bltr: "trbl",
};
const PERPENDICULAR: Record<SwingLine, SwingLine> = {
  horizontal: "vertical", vertical: "horizontal", falling: "rising", rising: "falling",
};
const MIRROR: Record<Way, Way> = {
  lr: "rl", rl: "lr", tb: "tb", tlbr: "trbl", trbl: "tlbr", brtl: "bltr", bltr: "brtl", stab: "stab",
};

export const isSwing = (way: Way): way is SwingDir => way !== "stab";
export const strikeOf = (attack: AttackKind, way: Way | null): Strike => (way === "stab" ? "stab" : attack);
export const mirrorWay = (way: Way): Way => MIRROR[way];

export const SCREEN_DIR: Record<SwingDir, { x: number; y: number }> = {
  lr: { x: 1, y: 0 }, rl: { x: -1, y: 0 }, tb: { x: 0, y: -1 },
  tlbr: { x: Math.SQRT1_2, y: -Math.SQRT1_2 }, brtl: { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
  trbl: { x: -Math.SQRT1_2, y: -Math.SQRT1_2 }, bltr: { x: Math.SQRT1_2, y: Math.SQRT1_2 },
};

export type ChainKind = "opening" | "reverse" | "perpendicular" | "other";

export function chainKind(last: Way | null, next: SwingDir): ChainKind {
  if (last === null || !isSwing(last)) return "opening";
  if (REVERSE[last] === next) return "reverse";
  return PERPENDICULAR[LINE[last]] === LINE[next] ? "perpendicular" : "other";
}

export const CHAIN = {
  /** × a swing's opening wind-up from its weapon's table, by how it follows the last. */
  windupShare: {
    opening: 1, reverse: 0.4 / 0.56, other: 0.48 / 0.56, perpendicular: 0.6 / 0.56,
  } satisfies Record<ChainKind, number>,
  // Applied after strength and swiftness: no attack is ever quicker to read than this.
  minWindupTime: 0.4,
  gapTime: 0.25,
} as const;

export const MOMENTUM = {
  gain: { opening: 0, reverse: 0.25, other: 1, perpendicular: 0.5 } satisfies Record<ChainKind, number>,
  max: 4,
  damagePerPoint: 0.25,
  maxDamage: 2,
  stabBonusPerPoint: 0.5,
} as const;

export const momentumDamage = (momentum: number): number =>
  Math.min(MOMENTUM.maxDamage, 1 + momentum * MOMENTUM.damagePerPoint);

export const HYBRID = {
  light: { knockbackSpeed: 4 },
  heavy: { knockbackSpeed: 8 },
  stab: { knockbackSpeed: 6 },
  block: {
    minDot: 0.34, chipFraction: 0.2, heavyStaminaFactor: 2, holdStaminaPerSec: 5, pushbackFactor: 0.6,
    brokenTime: 0.8, moveFactor: 0.4, perfectTime: 0.2, perfectAtLengthM: 1.1, remashTime: 0.5, perfectDrain: 10,
    perfectRecoilTime: 0.4, pinnedChipFactor: 2,
  },
  feint: { cutoffTime: 0.15, cost: 10 },
  parry: {
    windowTime: 0.3, fullRecoilTime: 0.8, partialRecoilTime: 0.5, minRecoilTime: 0.2, clashTime: 0.05,
    clashStaggerTime: 0.3, minRatio: 0.5, maxRatio: 2, heavyWeightFactor: 2,
  },
  // Just short enough that a guard raised once free is up before an enemy's counter lands.
  counter: { recoilTime: 0.25 },
  // Speeds in m/s.
  swinging: { lungeSpeed: 4, moveFactor: 0.25, liveTurnRadPerSec: 3, whiffCarrySpeed: 1.5 },
} as const;

/** Before strength and swiftness: the weapon's opening wind-up for the strike, × its chain's share for a swing. */
export const windupTime = (weapon: MeleeWeapon, strike: Strike, kind: ChainKind): number =>
  weapon.strikes[strike].windupTime * (strike === "stab" ? 1 : CHAIN.windupShare[kind]);

export const perfectBlockTime = (weapon: Guard): number =>
  HYBRID.block.perfectTime * weapon.length / HYBRID.block.perfectAtLengthM;

export const parryWindowTime = (weapon: Weapon): number =>
  HYBRID.parry.windowTime * weapon.length / HYBRID.block.perfectAtLengthM;

/** `strength` is the grip strength: a weapon raises quicker above its minimum, a shield never. */
export const guardRaiseTime = (guard: Guard, strength: number): number =>
  guard.raiseTime * strengthTimeFactor(guard, strength);

export type ParryKind = "full" | "partial";

export function parryKind(own: Way, seen: Way): ParryKind | null {
  if (!isSwing(own) || !isSwing(seen)) return null;
  const a = SCREEN_DIR[own], b = SCREEN_DIR[seen];
  // Facing each other the other's way is mirrored (x flips), and meeting it head on reverses it: only y flips.
  const dot = a.x * b.x - a.y * b.y;
  return dot > 0.99 ? "full" : dot > 0.7 ? "partial" : null;
}

export function parryWay(seen: SwingDir): SwingDir {
  const b = SCREEN_DIR[seen], meets = (way: SwingDir) => SCREEN_DIR[way].x * b.x - SCREEN_DIR[way].y * b.y;
  return SWING_DIRS.reduce((best, way) => (meets(way) > meets(best) ? way : best));
}

export const swingWeight = (weapon: MeleeWeapon, strength: number, heavy: boolean): number =>
  weapon.parryWeight * Math.sqrt(strength / AVERAGE_STAT) * (heavy ? HYBRID.parry.heavyWeightFactor : 1);

export const parryRecoilTime = (baseTime: number, weightRatio: number): number => Math.max(
  HYBRID.parry.minRecoilTime, baseTime * clamp(weightRatio, HYBRID.parry.minRatio, HYBRID.parry.maxRatio));

export const lastFeintStep = (liveAt: number): number => liveAt - toSteps(HYBRID.feint.cutoffTime) - 1;

const REACH_FACTOR = { swing: 1.15, stab: 1.75 } as const;
const ARC_DEG: Record<SwingLine | "stab", number> = {
  horizontal: 160, falling: 110, rising: 110, vertical: 60, stab: 16,
};

export function wayShape(way: Way, armReachM: number, weapon: Pick<Weapon, "length">): HitShape {
  const swing = isSwing(way), arcDeg = ARC_DEG[swing ? LINE[way] : "stab"];
  return {
    range: (armReachM + weapon.length) * REACH_FACTOR[swing ? "swing" : "stab"],
    minDot: Math.cos((arcDeg / 2) * (Math.PI / 180)),
  };
}

const DRAW_SHARE = 0.6;

/**
 * `windup` from `windupTime` (or swiftness after); `strength` the grip strength, whose points over the weapon's
 * minimum quicken every part a little. The floor comes last.
 */
export function wayStepsAfter(weapon: MeleeWeapon, strike: Strike, windup: number, strength: number): AttackSteps {
  const { liveTime, recoverTime } = weapon.strikes[strike], quick = strengthTimeFactor(weapon, strength);
  const finalWindup = Math.max(CHAIN.minWindupTime, windup * quick);
  const liveAt = toSteps(finalWindup), liveUntil = liveAt + toSteps(liveTime * quick);
  const endAt = liveUntil + toSteps(recoverTime * quick);
  return { driveAt: toSteps(finalWindup * DRAW_SHARE), liveAt, liveUntil, endAt };
}

/** A weapon's other times (whiff and feint recovery), quickened as its swings are. */
export const weaponTime = (weapon: MeleeWeapon, time: "whiffRecoverTime" | "feintRecoverTime", strength: number) =>
  weapon[time] * strengthTimeFactor(weapon, strength);

/** `strength` is the grip strength: each point over the weapon's minimum makes it cheaper, never dearer. */
export const strikeCost = (weapon: MeleeWeapon, strike: Strike, strength: number): number =>
  weapon.strikes[strike].cost * strengthDiscount(weapon, strength);

export function strikeDamage(weapon: MeleeWeapon, strike: Strike, power: number, stats: Stats): Damage {
  const base = scaleDamage(weapon.strikes[strike].damage, (weapon.quality ?? 1) * power);
  return typedDamage((type) => (base[type] > 0 ? physicalDamage(base[type], stats) : 0));
}

export type GuardKind = "shield" | "one" | "dual";

export const GUARDS = {
  shield: { minDot: 0, chipFraction: 0.08, staminaFactor: 0.6, pushFactor: 0.6 },
  one: { minDot: HYBRID.block.minDot, chipFraction: HYBRID.block.chipFraction, staminaFactor: 1, pushFactor: 1 },
  dual: { minDot: HYBRID.block.minDot, chipFraction: 0.32, staminaFactor: 1.35, pushFactor: 1.2 },
} as const satisfies Record<GuardKind, Record<"minDot" | "chipFraction" | "staminaFactor" | "pushFactor", number>>;

export const blockStaminaShare = (guard: (typeof GUARDS)[GuardKind], strength: number): number =>
  guard.staminaFactor / statFactor(strength, "blockStamina");
