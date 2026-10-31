import { coreStats, pointsEarned, SHOWN_STATS, type CoreState } from "@infinite-tower/shared";

export const CHART_RADIUS_PX = 64;
export const LABEL_RADIUS_PX = 76;
export const CHART_RINGS = 4;

export function chartPoints(values: readonly number[], max: number, radiusPx: number): [number, number][] {
  return values.map((value, i) => {
    const angle = (2 * Math.PI * i) / values.length, r = radiusPx * Math.min(1, Math.max(0, value / max));
    return [r * Math.sin(angle), -r * Math.cos(angle)];
  });
}

export function chartMax(core: CoreState): number {
  const bare = coreStats({ ...core, points: {} });
  return Math.max(...SHOWN_STATS.map((stat) => bare[stat])) + pointsEarned(core);
}
