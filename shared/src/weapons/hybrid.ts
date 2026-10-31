import { physicalDamage, type Stats } from "../battle/stats.js";
import { toSteps } from "../core/time.js";
import type { AttackSteps, HitShape, Weapon } from "./weapons.js";

// Named by their way across the screen as their swinger sees it ("tlbr": top left to bottom right), so a swing comes
// from its first letters' side; facing each other, one fighter's left is the other's right (`mirrorWay`).
export const SWING_DIRS = ["lr", "rl", "tb", "bt", "tlbr", "brtl", "trbl", "bltr"] as const;
export type SwingDir = (typeof SWING_DIRS)[number];
export const WAYS = [...SWING_DIRS, "stab"] as const;
export type Way = (typeof WAYS)[number];
export const STRIKES = ["light", "heavy", "stab"] as const;
export type Strike = (typeof STRIKES)[number];

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
const MIRROR: Record<Way, Way> = {
  lr: "rl", rl: "lr", tb: "tb", bt: "bt", tlbr: "trbl", trbl: "tlbr", brtl: "bltr", bltr: "brtl", stab: "stab",
};

export const isSwing = (way: Way): way is SwingDir => way !== "stab";
export const reverseOf = (dir: SwingDir): SwingDir => REVERSE[dir];
export const mirrorWay = (way: Way): Way => MIRROR[way];

export const SCREEN_DIR: Record<SwingDir, { x: number; y: number }> = {
  lr: { x: 1, y: 0 }, rl: { x: -1, y: 0 }, tb: { x: 0, y: -1 }, bt: { x: 0, y: 1 },
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
  startupTime: { opening: 0.1, reverse: 0.05, other: 0.1, perpendicular: 0.16 } satisfies Record<ChainKind, number>,
  stabStartupTime: 0.14,
  activeTime: 0.1,
  recoverTime: 0.08,
  gapTime: 0.25,
} as const;

export const MOMENTUM = {
  gain: { opening: 0, reverse: 1, other: 0.5, perpendicular: 0.25 } satisfies Record<ChainKind, number>,
  max: 4,
  damagePerPoint: 0.25,
  maxDamage: 2,
  speedPerPoint: 0.1,
  stabBonusPerPoint: 0.5,
} as const;

export const momentumDamage = (momentum: number): number =>
  Math.min(MOMENTUM.maxDamage, 1 + momentum * MOMENTUM.damagePerPoint);

export const startupTime = (kind: ChainKind, momentum: number): number =>
  CHAIN.startupTime[kind] * (1 - Math.min(momentum, MOMENTUM.max) * MOMENTUM.speedPerPoint);

export const HYBRID = {
  light: { cost: 16, damageFactor: 1, poiseDamage: 12 },
  heavy: { extraTime: 0.35, activeTime: 0.12, recoverTime: 0.2, cost: 24, damageFactor: 2, poiseDamage: 24 },
  stab: { cost: 20, damageFactor: 1.25, poiseDamage: 18 },
  block: {
    minDot: 0.34, staminaPerDamage: 1, chipFraction: 0.2, pushbackFactor: 0.6, brokenTime: 0.8, moveFactor: 0.4,
    tapParryTime: 0.25, riposteTime: 0.4, retapTime: 0.5,
  },
  kick: {
    cost: 15, contactTime: 0.2, time: 0.5, reachM: 1.4, minDot: 0.7, staggerTime: 0.6, shoveSpeed: 7, shoveTime: 0.25,
  },
  feint: { cutoffTime: 0.15, cost: 10 },
  /** The attacker steps forward at `lungeSpeed` (m/s) while the blade is live, and walks at `moveFactor` otherwise. */
  swinging: { lungeSpeed: 4, moveFactor: 0.25 },
} as const;

export const COUNTER_PARRY = {
  windowTime: 0.15, stunTime: 1, knockbackDist: 1.5, slideDecel: 30, playerStaggerTime: 0.5, playerKnockbackSpeed: 6,
  minDot: 0.5, offAngleShare: 0.5,
} as const;

const SIDE_RAD = Math.PI / 4;
/** 0 is the right, then anticlockwise, as its swinger sees it. */
const sideOf = (dir: SwingDir): number => {
  const way = SCREEN_DIR[dir];
  return (Math.round(Math.atan2(-way.y, -way.x) / SIDE_RAD) + 8) % 8;
};

export function parryShare(own: Way, seen: Way): number {
  if (!isSwing(own) || !isSwing(seen)) return own === seen ? 1 : 0;
  const apart = Math.abs(sideOf(REVERSE[own]) - sideOf(seen)) % 8, sides = Math.min(apart, 8 - apart);
  return sides === 0 ? 1 : sides === 1 ? COUNTER_PARRY.offAngleShare : 0;
}

const SHAPES: Record<SwingLine | "stab", { reachFactor: number; arcDeg: number }> = {
  horizontal: { reachFactor: 1, arcDeg: 160 },
  falling: { reachFactor: 1.15, arcDeg: 110 },
  rising: { reachFactor: 1.15, arcDeg: 110 },
  vertical: { reachFactor: 1.3, arcDeg: 60 },
  stab: { reachFactor: 1.75, arcDeg: 16 },
};

export function wayShape(way: Way, armReachM: number, weapon: Pick<Weapon, "length">): HitShape {
  const { reachFactor, arcDeg } = SHAPES[isSwing(way) ? LINE[way] : "stab"];
  return { range: (armReachM + weapon.length) * reachFactor, minDot: Math.cos((arcDeg / 2) * (Math.PI / 180)) };
}

const DRAW_SHARE = 0.6;

export function wayStepsAfter(weapon: Weapon, windup: number, heavy: boolean): AttackSteps {
  const live = heavy ? HYBRID.heavy.activeTime : CHAIN.activeTime;
  const recover = heavy ? HYBRID.heavy.recoverTime : CHAIN.recoverTime;
  const liveAt = toSteps(windup * weapon.heft), liveUntil = liveAt + toSteps(live * weapon.heft);
  const endAt = liveUntil + toSteps(recover * weapon.heft);
  return { driveAt: toSteps(windup * weapon.heft * DRAW_SHARE), liveAt, liveUntil, endAt };
}

export const strikeCost = (weapon: Weapon, strike: Strike): number => HYBRID[strike].cost * weapon.heft;

export const strikeDamage = (weapon: Weapon, strike: Strike, power: number, stats: Stats): number =>
  physicalDamage(weapon.damage * HYBRID[strike].damageFactor * power, stats);
