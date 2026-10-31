import { physicalDamage, type Stats } from "../battle/stats.js";
import { toSteps } from "../core/time.js";
import type { AttackSteps, HitShape, Weapon } from "./weapons.js";

export const LINES = ["high", "middle", "low"] as const;
export type Line = (typeof LINES)[number];
export type StrikeMove = "thrust" | "punch";

export const ONE_STRIKE = {
  startLine: "middle" as Line,
  lineMoveTime: 0.1,
  thrust: {
    windupTime: 0.3, liveTime: 0.1, recoverTime: 0.35, missRecoverTime: 0.5, stepInSpeed: 5, reachExtraM: 0.3,
    halfArcDeg: 12, cost: 8, staggerTime: 0.25,
  },
  /** A landed thrust's damage, as a share of the target's most HP; null: it passes over. */
  zones: {
    person: { high: 1, middle: 0.6, low: 0.2 },
    beast: { high: null, middle: 0.6, low: 1 },
  },
  lameMoveFactor: 0.5,
  clash: { minDot: 0.34, pushSpeed: 4, pushTime: 0.15, recoilTime: 0.25 },
  beat: {
    windupTime: 0.18, reachExtraM: 0.3, minDot: 0.7, offLineTime: 0.45, missOffLineTime: 0.35,
    cost: 15,
  },
  disarm: { throwM: 3, wallGapM: 0.4, recoilTime: 0.25 },
  punch: {
    windupTime: 0.15, liveTime: 0.08, recoverTime: 0.3, reachExtraM: 0.3, halfArcDeg: 30, damage: 4,
    staggerTime: 0.3,
  },
  pickup: { reachM: 0.6, time: 0.35 },
  /** The impaler is pushed back about a metre: `pushSpeed` easing off over `pushTime`. */
  beast: { lungeRecoilTime: 0.4, setTime: 0.3, setHalfArcDeg: 30, impale: { pushSpeed: 7, pushTime: 0.3 } },
} as const;

const cosDeg = (deg: number): number => Math.cos((deg * Math.PI) / 180);

export const lineMoveSteps = (heft: number): number => toSteps(ONE_STRIKE.lineMoveTime * heft);
export const linesApart = (a: Line, b: Line): number => Math.abs(LINES.indexOf(a) - LINES.indexOf(b));
export const lineToward = (from: Line, want: Line): Line =>
  LINES[LINES.indexOf(from) + Math.sign(LINES.indexOf(want) - LINES.indexOf(from))]!;
export const raised = (line: Line, by: 1 | -1): Line =>
  LINES[Math.min(LINES.length - 1, Math.max(0, LINES.indexOf(line) - by))]!;

export function strikeSteps(heft: number, move: StrikeMove, windupTime?: number): AttackSteps {
  const m = move === "thrust" ? ONE_STRIKE.thrust : ONE_STRIKE.punch;
  const recoverTime = move === "thrust" ? ONE_STRIKE.thrust.missRecoverTime : ONE_STRIKE.punch.recoverTime;
  const liveAt = toSteps((windupTime ?? m.windupTime) * heft), liveUntil = liveAt + toSteps(m.liveTime * heft);
  return { driveAt: Math.round(liveAt / 2), liveAt, liveUntil, endAt: liveUntil + toSteps(recoverTime * heft) };
}

export const landedCutSteps = (heft: number): number =>
  toSteps(ONE_STRIKE.thrust.missRecoverTime * heft) - toSteps(ONE_STRIKE.thrust.recoverTime * heft);

export const bladeReach = (armReachM: number, weapon: Pick<Weapon, "length">): number => armReachM + weapon.length;
export const thrustReach = (armReachM: number, weapon: Pick<Weapon, "length">): number =>
  bladeReach(armReachM, weapon) + ONE_STRIKE.thrust.reachExtraM;

export function strikeShape(move: StrikeMove, armReachM: number, weapon: Pick<Weapon, "length">): HitShape {
  return move === "thrust"
    ? { range: thrustReach(armReachM, weapon), minDot: cosDeg(ONE_STRIKE.thrust.halfArcDeg) }
    : { range: armReachM + ONE_STRIKE.punch.reachExtraM, minDot: cosDeg(ONE_STRIKE.punch.halfArcDeg) };
}

export const insidePoint = (gapM: number, weapon: Pick<Weapon, "length">): boolean => gapM < weapon.length / 2;
export const zoneShare = (beast: boolean, line: Line): number | null =>
  ONE_STRIKE.zones[beast ? "beast" : "person"][line];
export const punchDamage = (stats: Stats): number => physicalDamage(ONE_STRIKE.punch.damage, stats);
export const thrustCost = (weapon: Weapon): number => ONE_STRIKE.thrust.cost * weapon.heft;
export const beatCost = (weapon: Weapon): number => ONE_STRIKE.beat.cost * weapon.heft;
export const SET_MIN_DOT = cosDeg(ONE_STRIKE.beast.setHalfArcDeg);
