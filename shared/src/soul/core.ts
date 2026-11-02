import { BASE_STATS, HIDDEN_STATS, SHOWN_STATS, type ShownStat, type Stats } from "../battle/stats.js";
import { inscriptionStat, keptInscriptions, type InscriptionId } from "./inscriptions.js";

export const REALMS = ["Yan", "Sol", "Lux", "Ling", "Tian"] as const;
export const STEP_NAMES = ["Early", "Middle", "Peak"] as const;
export const CORE_STEPS = REALMS.length * STEP_NAMES.length;

export const CORE = {
  /** Essence to finish the first step; each step after needs more, doubling every `fillDoublingSteps`. */
  firstFill: 100,
  fillDoublingSteps: 3,
  /** A step of the first realm adds this to every shown stat and gives these free points; both × `realmFactor`
   * each realm after. */
  firstRealmGain: 1,
  firstRealmPoints: 2,
  realmFactor: 2,
  hiddenGain: 1,
} as const;

export type StatPoints = Partial<Record<ShownStat, number>>;

export interface CoreState {
  steps: number;
  fill: number;
  points: StatPoints;
  inscriptions: InscriptionId[];
}

export const newCore = (): CoreState => ({ steps: 0, fill: 0, points: {}, inscriptions: [] });

export const fillToFinish = (step: number): number =>
  Math.round(CORE.firstFill * 2 ** ((step - 1) / CORE.fillDoublingSteps));

const realmOf = (step: number): number => Math.floor((step - 1) / STEP_NAMES.length);
const gainOf = (step: number): number => CORE.firstRealmGain * CORE.realmFactor ** realmOf(step);
const pointsOf = (step: number): number => CORE.firstRealmPoints * CORE.realmFactor ** realmOf(step);
const sumTo = (steps: number, each: (step: number) => number): number => {
  let sum = 0;
  for (let step = 1; step <= steps; step++) sum += each(step);
  return sum;
};

export const coreWhole = (core: CoreState): boolean => core.steps >= CORE_STEPS;

export function coreName(core: CoreState): string {
  const at = Math.min(core.steps, CORE_STEPS - 1);
  return `${STEP_NAMES[at % STEP_NAMES.length]} ${REALMS[Math.floor(at / STEP_NAMES.length)]}`;
}

export const pointsEarned = (core: CoreState): number => sumTo(core.steps, pointsOf);
const pointsPlaced = (points: StatPoints): number => SHOWN_STATS.reduce((sum, stat) => sum + (points[stat] ?? 0), 0);
export const pointsLeft = (core: CoreState): number => pointsEarned(core) - pointsPlaced(core.points);

export function coreStats(core: CoreState): Stats {
  const gain = sumTo(core.steps, gainOf), hidden = core.steps * CORE.hiddenGain;
  const stats = { ...BASE_STATS };
  for (const stat of SHOWN_STATS) {
    stats[stat] += gain + (core.points[stat] ?? 0) + inscriptionStat(core.inscriptions, stat);
  }
  for (const stat of HIDDEN_STATS) stats[stat] += hidden;
  return stats;
}

export function absorb(core: CoreState, essence: number): CoreState {
  let { steps, fill } = core;
  fill += essence;
  while (steps < CORE_STEPS && fill >= fillToFinish(steps + 1)) fill -= fillToFinish(++steps);
  return { ...core, steps, fill: steps >= CORE_STEPS ? 0 : fill };
}

const isShown = (stat: string): stat is ShownStat => (SHOWN_STATS as readonly string[]).includes(stat);

export function placePoint(core: CoreState, stat: ShownStat): CoreState | null {
  if (!isShown(stat) || pointsLeft(core) <= 0) return null;
  return { ...core, points: { ...core.points, [stat]: (core.points[stat] ?? 0) + 1 } };
}

export function takeBackPoint(core: CoreState, stat: ShownStat): CoreState | null {
  const placed = core.points[stat] ?? 0;
  if (!isShown(stat) || placed <= 0) return null;
  const points = { ...core.points, [stat]: placed - 1 };
  if (placed === 1) delete points[stat];
  return { ...core, points };
}

function fitPoints(core: CoreState): CoreState {
  let fitted = core;
  while (pointsLeft(fitted) < 0) {
    const most = SHOWN_STATS.reduce((a, b) => ((fitted.points[b] ?? 0) > (fitted.points[a] ?? 0) ? b : a));
    fitted = takeBackPoint(fitted, most)!;
  }
  return fitted;
}

export function coreAfterDeath(core: CoreState): CoreState {
  if (core.fill > 0) return { ...core, fill: 0 };
  if (core.steps === 0) return core;
  return fitPoints({ ...core, steps: core.steps - 1 });
}

export const coreAtStep = (core: CoreState, steps: number): CoreState =>
  fitPoints({ ...core, steps: Math.max(0, Math.min(CORE_STEPS, steps)), fill: 0 });

const wholeAtLeast = (n: unknown, min: number): number =>
  (typeof n === "number" && Number.isFinite(n) ? Math.max(min, Math.floor(n)) : min);

export function keptCore(
  saved: { steps: unknown; fill: unknown; points: unknown; inscriptions?: unknown },
): CoreState {
  const steps = Math.min(CORE_STEPS, wholeAtLeast(saved.steps, 0));
  const fill = steps >= CORE_STEPS ? 0 : Math.min(fillToFinish(steps + 1) - 1, wholeAtLeast(saved.fill, 0));
  const given: Record<string, unknown> =
    saved.points !== null && typeof saved.points === "object" ? saved.points as Record<string, unknown> : {};
  const points: StatPoints = {}, inscriptions = keptInscriptions(saved.inscriptions);
  const earned = pointsEarned({ steps, fill, points, inscriptions });
  for (const stat of SHOWN_STATS) {
    const placed = Math.min(earned, wholeAtLeast(given[stat], 0));
    if (placed > 0) points[stat] = placed;
  }
  return fitPoints({ steps, fill, points, inscriptions });
}
