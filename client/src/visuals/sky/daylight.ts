import { Color3 } from "@babylonjs/core";
import {
  clamp, dayFraction, moonAt, retimeDay, sunAt, WALL_CLOCK, type DayChange, type DayClock, type Vec3,
} from "@infinite-tower/shared";

interface DirectLight { body: "sun" | "moon"; toLight: Vec3; strength: number }

export const MOONLIGHT = { color: new Color3(0.6, 0.7, 1), intensity: 0.6 };
const SUN_FADE_DEG = [-1, 5] as const;
const DUSK_FADE_DEG = [-8, -1] as const;
const MOON_FADE_DEG = [0, 6] as const;
const DISC_FADE_DEG = [-3, 1] as const;

const DAYLIGHT = [
  { altDeg: -12, sky: [0.32, 0.38, 0.62], skyLight: [0.62, 0.72, 1], skyLightScale: 1, sunTint: [1, 0.6, 0.4] },
  { altDeg: -4, sky: [0.7, 0.55, 0.66], skyLight: [0.85, 0.75, 0.92], skyLightScale: 1.5, sunTint: [1, 0.6, 0.4] },
  { altDeg: 4, sky: [1.1, 0.88, 0.75], skyLight: [1, 0.9, 0.82], skyLightScale: 2, sunTint: [1.05, 0.82, 0.64] },
  { altDeg: 20, sky: [1, 1, 1], skyLight: [1, 1, 1], skyLightScale: 1.3, sunTint: [1, 1.06, 1.15] },
  { altDeg: 45, sky: [1, 1, 1], skyLight: [1, 1, 1], skyLightScale: 1, sunTint: [1, 1.12, 1.3] },
] as const;

let clock: DayClock = WALL_CLOCK;

export function setDayClock(change: DayChange): void {
  clock = retimeDay(clock, Date.now(), change);
}

export const dayFractionAt = (nowMs: number) => dayFraction(clock, nowMs);

const altitudeDeg = (v: Vec3) => (Math.asin(clamp(v.y, -1, 1)) * 180) / Math.PI;
const smoothstep = ([lo, hi]: readonly [number, number], x: number) => {
  const t = clamp((x - lo) / (hi - lo), 0, 1);
  return t * t * (3 - 2 * t);
};

export function directLightAt(fraction: number): DirectLight {
  const sun = sunAt(fraction), sunAlt = altitudeDeg(sun);
  const sunUp = smoothstep(SUN_FADE_DEG, sunAlt);
  if (sunUp > 0) return { body: "sun", toLight: sun, strength: sunUp };
  const moon = moonAt(fraction);
  return { body: "moon", toLight: moon, strength: (1 - smoothstep(DUSK_FADE_DEG, sunAlt)) * smoothstep(MOON_FADE_DEG,
    altitudeDeg(moon)) };
}

export function daylightAt(fraction: number) {
  const alt = altitudeDeg(sunAt(fraction));
  const i = DAYLIGHT.findIndex((k) => k.altDeg > alt);
  const a = DAYLIGHT[i <= 0 ? 0 : i - 1]!, b = DAYLIGHT[i < 0 ? DAYLIGHT.length - 1 : i]!;
  const t = a === b ? 0 : (alt - a.altDeg) / (b.altDeg - a.altDeg);
  const mix = (x: readonly number[], y: readonly number[]) =>
    new Color3(x[0]! + (y[0]! - x[0]!) * t, x[1]! + (y[1]! - x[1]!) * t, x[2]! + (y[2]! - x[2]!) * t);
  return {
    sky: mix(a.sky, b.sky), skyLight: mix(a.skyLight, b.skyLight), sunTint: mix(a.sunTint, b.sunTint),
    skyLightScale: a.skyLightScale + (b.skyLightScale - a.skyLightScale) * t,
    sunDiscAlpha: smoothstep(DISC_FADE_DEG, alt),
    moonDiscAlpha: smoothstep(DISC_FADE_DEG, altitudeDeg(moonAt(fraction))) * (1 - 0.6 * smoothstep(SUN_FADE_DEG, alt)),
  };
}
