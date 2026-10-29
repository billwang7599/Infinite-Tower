import type { Vec3 } from "../core/math.js";

export const DAY_LENGTH_MS = 24 * 60_000;
/** A summer day this far north: the sun is up ~64% of the day and peaks at 60°. */
const LATITUDE_RAD = (50 * Math.PI) / 180;
const SUN_DECLINATION_RAD = (20 * Math.PI) / 180;
/** Low in the south at midnight (30°), up ~43% of the day: a summer full moon. */
const MOON_DECLINATION_RAD = (-10 * Math.PI) / 180;

/** The day's fraction (0 midnight, 0.5 noon) was `fraction` at `atMs`, running `speed` days per day. */
export interface DayClock { atMs: number; fraction: number; speed: number }

export const WALL_CLOCK: DayClock = { atMs: 0, fraction: 0, speed: 1 };

const wrap = (f: number) => f - Math.floor(f);

export function dayFraction(clock: DayClock, nowMs: number): number {
  return wrap(clock.fraction + ((nowMs - clock.atMs) * clock.speed) / DAY_LENGTH_MS);
}

export interface DayChange { offsetFraction?: number; fraction?: number; speed?: number }

export function retimeDay(clock: DayClock, nowMs: number, change: DayChange): DayClock {
  const at = change.fraction ?? dayFraction(clock, nowMs);
  return { atMs: nowMs, fraction: wrap(at + (change.offsetFraction ?? 0)), speed: change.speed ?? clock.speed };
}

/** Toward the body: x east, y up, z north. */
function skyDirection(hourAngleRad: number, declinationRad: number): Vec3 {
  const cosD = Math.cos(declinationRad), sinD = Math.sin(declinationRad);
  const cosL = Math.cos(LATITUDE_RAD), sinL = Math.sin(LATITUDE_RAD), cosH = Math.cos(hourAngleRad);
  return {
    x: -cosD * Math.sin(hourAngleRad),
    y: sinL * sinD + cosL * cosD * cosH,
    z: cosL * sinD - sinL * cosD * cosH,
  };
}

export function sunAt(fraction: number): Vec3 {
  return skyDirection(2 * Math.PI * (fraction - 0.5), SUN_DECLINATION_RAD);
}

export function moonAt(fraction: number): Vec3 {
  return skyDirection(2 * Math.PI * fraction, MOON_DECLINATION_RAD);
}
