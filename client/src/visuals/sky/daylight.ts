import { Color3 } from "@babylonjs/core";
import {
  clamp, dayFraction, moonAt, retimeDay, smoothstep, sunAt, WALL_CLOCK, type DayChange, type DayClock, type Vec3,
} from "@infinite-tower/shared";

interface DirectLight { body: "sun" | "moon"; toLight: Vec3; strength: number }

const SUN_FADE_DEG = [-1, 5] as const;
const DUSK_FADE_DEG = [-8, -1] as const;
const MOON_FADE_DEG = [0, 6] as const;
const DISC_FADE_DEG = [-3, 1] as const;

// `zenith` × the horizon's colour is the sky overhead. A low sun is brighter (`sunScale`) for falling so flat.
const DAYLIGHT = [
  { altDeg: -12, sky: [0.32, 0.38, 0.62], zenith: [0.45, 0.5, 0.75], skyLight: [0.62, 0.72, 1], skyLightScale: 1,
    sunTint: [1, 0.6, 0.4], sunScale: 1, glow: 0 },
  { altDeg: -4, sky: [0.7, 0.55, 0.66], zenith: [0.6, 0.6, 0.95], skyLight: [0.85, 0.75, 0.92], skyLightScale: 1.4,
    sunTint: [1, 0.6, 0.4], sunScale: 1, glow: 0.7 },
  { altDeg: 4, sky: [1.1, 0.88, 0.75], zenith: [0.75, 0.8, 1.25], skyLight: [1, 0.88, 0.78], skyLightScale: 1.6,
    sunTint: [1.1, 0.8, 0.58], sunScale: 1.7, glow: 1.4 },
  { altDeg: 20, sky: [1.04, 1, 0.96], zenith: [0.8, 0.95, 1.45], skyLight: [1.04, 1, 0.94], skyLightScale: 1.3,
    sunTint: [1.14, 1.02, 0.84], sunScale: 1.25, glow: 0.8 },
  { altDeg: 45, sky: [1.03, 1, 0.97], zenith: [0.8, 0.95, 1.5], skyLight: [1.03, 1, 0.95], skyLightScale: 1.05,
    sunTint: [1.1, 1.03, 0.88], sunScale: 1.08, glow: 0.55 },
] as const;

let clock: DayClock = WALL_CLOCK;

export function setDayClock(change: DayChange): void {
  clock = retimeDay(clock, Date.now(), change);
}

export const dayFractionAt = (nowMs: number) => dayFraction(clock, nowMs);

const altitudeDeg = (v: Vec3) => (Math.asin(clamp(v.y, -1, 1)) * 180) / Math.PI;

export function directLightAt(fraction: number): DirectLight {
  const sun = sunAt(fraction), sunAlt = altitudeDeg(sun);
  const sunUp = smoothstep(...SUN_FADE_DEG, sunAlt);
  if (sunUp > 0) return { body: "sun", toLight: sun, strength: sunUp };
  const moon = moonAt(fraction);
  return { body: "moon", toLight: moon, strength: (1 - smoothstep(...DUSK_FADE_DEG, sunAlt)) * smoothstep(
    ...MOON_FADE_DEG, altitudeDeg(moon)) };
}

export function daylightAt(fraction: number) {
  const alt = altitudeDeg(sunAt(fraction));
  const i = DAYLIGHT.findIndex((k) => k.altDeg > alt);
  const a = DAYLIGHT[i <= 0 ? 0 : i - 1]!, b = DAYLIGHT[i < 0 ? DAYLIGHT.length - 1 : i]!;
  const t = a === b ? 0 : (alt - a.altDeg) / (b.altDeg - a.altDeg);
  const mix = (x: readonly number[], y: readonly number[]) =>
    new Color3(x[0]! + (y[0]! - x[0]!) * t, x[1]! + (y[1]! - x[1]!) * t, x[2]! + (y[2]! - x[2]!) * t);
  return {
    sky: mix(a.sky, b.sky), zenith: mix(a.zenith, b.zenith), skyLight: mix(a.skyLight, b.skyLight),
    sunTint: mix(a.sunTint, b.sunTint), skyLightScale: a.skyLightScale + (b.skyLightScale - a.skyLightScale) * t,
    sunScale: a.sunScale + (b.sunScale - a.sunScale) * t, glow: a.glow + (b.glow - a.glow) * t,
    night: 1 - smoothstep(...DUSK_FADE_DEG, alt),
    sunDiscAlpha: smoothstep(...DISC_FADE_DEG, alt),
    moonDiscAlpha: smoothstep(...DISC_FADE_DEG, altitudeDeg(moonAt(fraction)))
      * (1 - 0.6 * smoothstep(...SUN_FADE_DEG, alt)),
  };
}
