import { physicalDamage, type Stats } from "../battle/stats.js";
import { toSteps } from "../core/time.js";
import { feltHeft, type AttackSteps, type HitShape, type Weapon } from "./weapons.js";

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
  startupTime: { opening: 0.35, reverse: 0.25, other: 0.3, perpendicular: 0.45 } satisfies Record<ChainKind, number>,
  minStartupTime: 0.25,
  stabStartupTime: 0.3,
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

export const startupTime = (kind: ChainKind, momentum: number): number => Math.max(
  CHAIN.minStartupTime, CHAIN.startupTime[kind] * (1 - Math.min(momentum, MOMENTUM.max) * MOMENTUM.speedPerPoint));

export const HYBRID = {
  light: { cost: 10, damageFactor: 1, poiseDamage: 12 },
  heavy: { extraTime: 0.35, activeTime: 0.12, recoverTime: 0.2, cost: 16, damageFactor: 2, poiseDamage: 24 },
  stab: { cost: 12, damageFactor: 1.25, poiseDamage: 18 },
  block: {
    minDot: 0.34, chipFraction: 0.2, heavyStaminaFactor: 2, holdStaminaPerSec: 5, pushbackFactor: 0.6,
    brokenTime: 0.8, moveFactor: 0.4, perfectTime: 0.2, remashTime: 0.5, perfectDrain: 10, perfectRecoilTime: 0.4,
  },
  feint: { cutoffTime: 0.15, cost: 10 },
  /** The attacker steps forward at `lungeSpeed` (m/s) while the blade is live, and walks at `moveFactor` otherwise. */
  swinging: { lungeSpeed: 4, moveFactor: 0.25 },
} as const;

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

export function wayStepsAfter(weapon: Weapon, windup: number, heavy: boolean, strength: number): AttackSteps {
  const live = heavy ? HYBRID.heavy.activeTime : CHAIN.activeTime;
  const recover = heavy ? HYBRID.heavy.recoverTime : CHAIN.recoverTime;
  const heft = feltHeft(weapon, strength);
  const liveAt = toSteps(windup * heft), liveUntil = liveAt + toSteps(live * heft);
  const endAt = liveUntil + toSteps(recover * heft);
  return { driveAt: toSteps(windup * heft * DRAW_SHARE), liveAt, liveUntil, endAt };
}

export const strikeCost = (weapon: Weapon, strike: Strike, strength: number): number =>
  HYBRID[strike].cost * feltHeft(weapon, strength);

export const strikeDamage = (weapon: Weapon, strike: Strike, power: number, stats: Stats): number =>
  physicalDamage(weapon.damage * HYBRID[strike].damageFactor * power, stats);
