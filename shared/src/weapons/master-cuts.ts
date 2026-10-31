import { physicalDamage, type Stats } from "../battle/stats.js";
import { toSteps } from "../core/time.js";
import type { AttackSteps, HitShape, Weapon } from "./weapons.js";

export const STANCES = ["vom-tag", "ochs", "pflug", "alber"] as const;
export type Stance = (typeof STANCES)[number];
export type CutMove = "strike" | "cut";

export const BREAKS: Record<Stance, Stance> = { "vom-tag": "alber", alber: "ochs", ochs: "pflug", pflug: "vom-tag" };
export const breakerOf = (stance: Stance): Stance => STANCES.find((s) => BREAKS[s] === stance)!;

interface CutShape { arcDeg: number; reachFactor: number }
interface StrikeDef extends CutShape { name: string; windupTime: number; damageFactor: number }

export const MASTER_CUTS = {
  startStance: "vom-tag" as Stance,
  guard: { moveTime: 0.25, recoverMoveTime: 0.15, cost: 3 },
  strikes: {
    "vom-tag": { name: "Oberhau", windupTime: 0.45, damageFactor: 1.2, arcDeg: 160, reachFactor: 1 },
    ochs: { name: "Oberstich", windupTime: 0.3, damageFactor: 0.9, arcDeg: 30, reachFactor: 1.25 },
    pflug: { name: "Unterstich", windupTime: 0.3, damageFactor: 0.9, arcDeg: 30, reachFactor: 1.25 },
    alber: { name: "Unterhau", windupTime: 0.4, damageFactor: 1, arcDeg: 140, reachFactor: 1 },
  } satisfies Record<Stance, StrikeDef>,
  strike: { liveTime: 0.1, recoverTime: 0.35, maxChain: 3, chainWindupFactor: 0.85, cost: 10, poiseDamage: 12 },
  cuts: {
    "vom-tag": { name: "Scheitelhau", arcDeg: 40, reachFactor: 1.3 },
    ochs: { name: "Schielhau", arcDeg: 60, reachFactor: 1.15 },
    pflug: { name: "Zwerchhau", arcDeg: 140, reachFactor: 1 },
    alber: { name: "Krumphau", arcDeg: 100, reachFactor: 1 },
  } satisfies Record<Stance, CutShape & { name: string }>,
  cut: { windupTime: 0.35, liveTime: 0.12, recoverTime: 0.4, damageFactor: 1.3, cost: 16, poiseDamage: 24 },
  /** A counter covers attackers within this cosine of where it faces (0.34: 140°). */
  counter: { windowTime: 0.3, minDot: 0.34, openTime: 0.6 },
  bind: { attackerRecoilTime: 0.45, counterRecoilTime: 0.3, cost: 8 },
  fehler: { cutoffTime: 0.15, minWindupTime: 0.2, cost: 6 },
} as const;

export const COUNTER_STEPS = toSteps(MASTER_CUTS.counter.windowTime);

export const guardMoveSteps = (heft: number, recovering: boolean): number =>
  toSteps((recovering ? MASTER_CUTS.guard.recoverMoveTime : MASTER_CUTS.guard.moveTime) * heft);

export const cutWindupTime = (move: CutMove, stance: Stance, chain: number): number => move === "cut"
  ? MASTER_CUTS.cut.windupTime
  : MASTER_CUTS.strikes[stance].windupTime * (chain > 0 ? MASTER_CUTS.strike.chainWindupFactor : 1);

export function cutSteps(heft: number, move: CutMove, windupTime: number): AttackSteps {
  const m = move === "cut" ? MASTER_CUTS.cut : MASTER_CUTS.strike;
  const liveAt = toSteps(windupTime * heft), liveUntil = liveAt + toSteps(m.liveTime * heft);
  return { driveAt: Math.round(liveAt * 0.6), liveAt, liveUntil, endAt: liveUntil + toSteps(m.recoverTime * heft) };
}

export const cutDamage = (weapon: Weapon, move: CutMove, stance: Stance, stats: Stats): number => physicalDamage(
  weapon.damage * (move === "cut" ? MASTER_CUTS.cut.damageFactor : MASTER_CUTS.strikes[stance].damageFactor), stats,
);

export const cutCost = (weapon: Weapon, move: CutMove): number =>
  (move === "cut" ? MASTER_CUTS.cut.cost : MASTER_CUTS.strike.cost) * weapon.heft;

export function cutShape(move: CutMove, stance: Stance, armReachM: number, weapon: Pick<Weapon, "length">): HitShape {
  const { arcDeg, reachFactor } = move === "cut" ? MASTER_CUTS.cuts[stance] : MASTER_CUTS.strikes[stance];
  return { range: (armReachM + weapon.length) * reachFactor, minDot: Math.cos((arcDeg / 2) * (Math.PI / 180)) };
}
