import { physicalDamage, type Stats } from "../battle/stats.js";
import { toSteps } from "../core/time.js";
import type { AttackSteps, Weapon } from "./weapons.js";

export const PERILOUS = ["thrust", "sweep"] as const;
export type Perilous = (typeof PERILOUS)[number];
export type PostureMove = "swing" | "finisher" | Perilous;
export type PerilousEnd = Perilous | "grab";

interface MoveDef {
  windupTime: number;
  liveTime: number;
  recoverTime: number;
  damageFactor: number;
  posture: number;
  cost: number;
}

export const POSTURE_MOVES = {
  swing: { windupTime: 0.3, liveTime: 0.1, recoverTime: 0.3, damageFactor: 0.8, posture: 12, cost: 0 },
  finisher: { windupTime: 0.45, liveTime: 0.12, recoverTime: 0.45, damageFactor: 1.5, posture: 20, cost: 0 },
  thrust: { windupTime: 0.6, liveTime: 0.1, recoverTime: 0.5, damageFactor: 1.5, posture: 30, cost: 15 },
  sweep: { windupTime: 0.55, liveTime: 0.12, recoverTime: 0.5, damageFactor: 1.2, posture: 20, cost: 15 },
} as const satisfies Record<PostureMove, MoveDef>;

export const POSTURE = {
  max: 100,
  stringLength: 4,
  chainWindupTime: 0.25,
  /** A guard or a deflect covers attackers within this cosine of where its holder faces (0.34: 140°). */
  guardMinDot: 0.34,
  /** Per second, from `delayTime` after it last grew; × `guardingFactor` guarding; × (lowHpShare + the rest × HP share). */
  recovery: { delayTime: 1, perSec: 20, guardingFactor: 1.5, lowHpShare: 0.3 },
  deflect: {
    windowTime: 0.2, shrinkTime: 0.05, minWindowTime: 0.067, spamTime: 0.5, thrustWindowTime: 0.12,
    takenShare: 0.25, posture: 15, streakPosture: 5, maxStreakPosture: 15, streakTime: 1, recoilTime: 0.25,
    bodyBlowPosture: 25,
  },
  hitShare: 0.5,
  sweepStaggerTime: 0.4,
  mikiri: { minDot: Math.SQRT1_2, withinTime: 0.3, posture: 45, openTime: 0.6 },
  jumpKick: { reachM: 1.5, minDot: -1, posture: 30, staggerTime: 0.3, bounceSpeed: 5 },
  broken: { playerTime: 1.2, enemyTime: 1.5, deathblowShare: 0.35, afterShare: 0.5 },
  zanshin: { windowTime: 0.15, posture: 15, recoverCutTime: 0.1 },
  grab: { windupTime: 0.5, damage: 25, posture: 30, staggerTime: 0.6, recoverTime: 0.5 },
} as const;

export const DEFLECT_STEPS = {
  window: toSteps(POSTURE.deflect.windowTime),
  shrink: toSteps(POSTURE.deflect.shrinkTime),
  min: toSteps(POSTURE.deflect.minWindowTime),
  spam: toSteps(POSTURE.deflect.spamTime),
  thrust: toSteps(POSTURE.deflect.thrustWindowTime),
} as const;

const DRAW_SHARE = 0.6;

export function postureSteps(weapon: Weapon, move: PostureMove, windupTime: number, delayTime = 0): AttackSteps {
  const m = POSTURE_MOVES[move], heft = weapon.heft;
  const liveAt = toSteps((windupTime + delayTime) * heft), liveUntil = liveAt + toSteps(m.liveTime * heft);
  return {
    driveAt: toSteps(windupTime * heft * DRAW_SHARE), liveAt, liveUntil,
    endAt: liveUntil + toSteps(m.recoverTime * heft),
  };
}

export const moveOf = (chain: number): PostureMove => (chain + 1 >= POSTURE.stringLength ? "finisher" : "swing");

export const moveDamage = (weapon: Weapon, move: PostureMove, stats: Stats): number =>
  physicalDamage(weapon.damage * POSTURE_MOVES[move].damageFactor, stats);

export const deflectPosture = (streak: number): number =>
  POSTURE.deflect.posture + Math.min(POSTURE.deflect.maxStreakPosture, streak * POSTURE.deflect.streakPosture);

export const recoveryPerSec = (hpShare: number, guarding: boolean): number => {
  const r = POSTURE.recovery;
  return r.perSec * (guarding ? r.guardingFactor : 1) * (r.lowHpShare + (1 - r.lowHpShare) * hpShare);
};

/** In steps. */
export const nextWindow = (last: number, sinceRelease: number): number =>
  sinceRelease < DEFLECT_STEPS.spam ? Math.max(DEFLECT_STEPS.min, last - DEFLECT_STEPS.shrink) : DEFLECT_STEPS.window;
