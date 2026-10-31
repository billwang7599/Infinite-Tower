import {
  clamp, CORE_STEPS, coreWhole, fillToFinish, REALMS, smoothstep, STEP_NAMES, type CoreState,
} from "@infinite-tower/shared";

export type Realm = (typeof REALMS)[number];
export type Rgb = readonly [number, number, number];
export type Color = [number, number, number];

export interface Lit {
  intensity: number;
  hue: number;
}

/** u, v: the spot in glass radii from the centre (v down), d its distance; radius: the light's; px: one pixel. */
type Shape = (
  u: number, v: number, d: number, time: number, radius: number, px: number, seed: number, out: Lit,
) => void;

export interface RealmLook {
  glyph: string;
  smoke: number;
  glow: number;
  ramp: readonly Rgb[];
  ramp2: readonly Rgb[];
  halo: readonly [number, number, number];
  /** Glass radii a second a spark rises by. */
  sparkLift: number;
  shape: Shape;
}

export const LIGHT = {
  /** Glass radii: Early Yan's light, and what each step of a realm adds; a new realm starts condensed, a little
   * bigger than the last realm's Early. */
  firstRadius: 0.18,
  radiusPerStep: 0.09,
  radiusPerRealm: 0.035,
  firstBrightness: 0.6,
  brightnessPerStep: 0.045,
} as const;

export const SPARKS_FROM = 0.7;
const MOST_SPARKS_PER_SEC = 26;

export function coreLight(steps: number): { realm: Realm; step: number; radius: number; brightness: number } {
  const at = Math.min(steps, CORE_STEPS - 1);
  const realm = Math.floor(at / STEP_NAMES.length), step = at % STEP_NAMES.length;
  return {
    realm: REALMS[realm]!,
    step,
    radius: LIGHT.firstRadius + LIGHT.radiusPerStep * step + LIGHT.radiusPerRealm * realm,
    brightness: LIGHT.firstBrightness + LIGHT.brightnessPerStep * at,
  };
}

export const nearness = (core: CoreState): number =>
  (coreWhole(core) ? 0 : clamp(core.fill / fillToFinish(core.steps + 1), 0, 1));

export const sparksPerSec = (near: number): number =>
  (near <= SPARKS_FROM ? 0 : MOST_SPARKS_PER_SEC * ((near - SPARKS_FROM) / (1 - SPARKS_FROM)) ** 1.5);

function hash2(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function noise2(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export const fbm2 = (x: number, y: number): number =>
  0.55 * noise2(x, y) + 0.3 * noise2(x * 2.07 + 5.3, y * 2.07 + 1.7) + 0.15 * noise2(x * 4.1 + 9.1, y * 4.1 + 3.3);

const flame: Shape = (u, v, _d, time, radius, _px, seed, out) => {
  const flicker = 0.84 + 0.2 * (noise2(time * 6.5, seed) - 0.5) + 0.1 * (noise2(time * 17, seed + 3) - 0.5);
  const up = Math.max(0, -v) / radius;
  const uu = u / (1 - Math.min(up, 2.2) * 0.34) + (noise2(u * 5 + seed, v * 5 + time * 3) - 0.5) * 0.55 * radius;
  const below = v - 0.2 * radius;
  const vv = below * (below < 0 ? 0.42 : 1.3) + (noise2(u * 4 + seed + 7, v * 4 + time * 2.4) - 0.5) * 0.5 * radius;
  const dd2 = (uu * uu + vv * vv) / (radius * radius);
  out.intensity = flicker * (Math.exp(-dd2 * 1.6) + 0.35 * Math.exp(-dd2 * 7));
  out.hue = 0;
};

const sun: Shape = (u, v, d, time, radius, _px, _seed, out) => {
  const dd = d / radius;
  const disc = clamp((0.6 - dd) / 0.12, 0, 1);
  const rays = (0.5 + 0.5 * Math.cos(Math.atan2(v, u) * 12 + time * 0.15)) ** 5 * smoothstep(0.5, 0.9, dd)
    * Math.exp(-(dd - 0.9) * 0.9);
  out.intensity = 0.75 * disc + 0.5 * Math.exp(-dd * dd * 0.85) + 0.3 * rays;
  out.hue = 0;
};

const star: Shape = (u, v, d, time, radius, px, seed, out) => {
  const dd = d / radius, px2 = px * px, len = radius * 1.5;
  const twinkle = 0.85 + 0.15 * Math.sin(time * 1.2 + seed);
  const cross = Math.exp(-(v * v) / px2) * Math.exp(-Math.abs(u) / len)
    + Math.exp(-(u * u) / px2) * Math.exp(-Math.abs(v) / len);
  const du = (u + v) * Math.SQRT1_2, dv = (u - v) * Math.SQRT1_2;
  const diagonal = Math.exp(-(dv * dv) / px2) * Math.exp(-Math.abs(du) / (len * 0.45))
    + Math.exp(-(du * du) / px2) * Math.exp(-Math.abs(dv) / (len * 0.45));
  out.intensity = 1.25 * Math.exp(-dd * dd * 3.2) + 0.5 * Math.exp(-dd * dd * 0.6)
    + twinkle * (0.75 * cross + 0.35 * diagonal);
  out.hue = 0;
};

const spirit: Shape = (u, v, d, time, radius, _px, seed, out) => {
  const dd = d / radius;
  const heart = 0.85 * Math.exp(-dd * dd * 2.2);
  const swirl = time * 0.35 + (1.4 - d) * 2.4;
  const cs = Math.cos(swirl), sn = Math.sin(swirl);
  const ru = u * cs - v * sn, rv = u * sn + v * cs;
  const ridge = 1 - Math.abs(fbm2(ru * 2.6 + seed, rv * 2.6 + time * 0.12) - 0.5) * 2;
  const reach = radius * 2.3;
  const wisp = smoothstep(0.8, 0.95, ridge) * Math.exp(-(d * d) / (reach * reach)) * smoothstep(0, radius * 0.7, d);
  const hue = smoothstep(0.38, 0.62, noise2(ru * 1.6 + 20, rv * 1.6 + time * 0.1));
  out.intensity = heart + 0.45 * wisp;
  out.hue = wisp > heart ? hue : hue * 0.25;
};

const heaven: Shape = (u, v, d, time, radius, _px, _seed, out) => {
  const dd = d / radius, angle = Math.atan2(v, u);
  out.intensity = 0.85 * Math.exp(-dd * dd * 1.8) + 0.1 + 0.05 * Math.sin(angle * 3 - time * 0.4 + d * 5);
  out.hue = 0.35 + 0.35 * Math.sin(angle * 2 + time * 0.3 + d * 4);
};

export function rampAt(ramp: readonly Rgb[], x: number, out: Color): Color {
  const f = clamp(x, 0, 1) * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(f)), k = f - i;
  const [ar, ag, ab] = ramp[i]!, [br, bg, bb] = ramp[i + 1]!;
  out[0] = ar + (br - ar) * k; out[1] = ag + (bg - ag) * k; out[2] = ab + (bb - ab) * k;
  return out;
}

const second: Color = [0, 0, 0];
export function mixRamps(look: RealmLook, x: number, hue: number, out: Color): Color {
  rampAt(look.ramp, x, out);
  if (hue <= 0) return out;
  rampAt(look.ramp2, x, second);
  out[0] += (second[0] - out[0]) * hue; out[1] += (second[1] - out[1]) * hue; out[2] += (second[2] - out[2]) * hue;
  return out;
}

const channel = (hex: string, at: number) => parseInt(hex.slice(at, at + 2), 16) / 255;
const rgb = (hexes: readonly string[]): Rgb[] =>
  hexes.map((hex): Rgb => [channel(hex, 1), channel(hex, 3), channel(hex, 5)]);

const NO_HALO = [0, 0, 0] as const;

const YAN = rgb(["#1c0300", "#5e0d02", "#a8240a", "#e2560f", "#ff9a2e", "#ffd77a", "#fff6dc"]);
const SOL = rgb(["#1e1000", "#5a3504", "#a8700e", "#e0a72e", "#ffd76a", "#fff1bf", "#fffdf2"]);
const LUX = rgb(["#0e1018", "#343a4c", "#767f98", "#b9c1d6", "#e8ecf6", "#ffffff", "#ffffff"]);

export const REALM_LOOKS: Record<Realm, RealmLook> = {
  Yan: { glyph: "炎", smoke: 1, glow: 0.22, ramp: YAN, ramp2: YAN, halo: NO_HALO, sparkLift: 0.5, shape: flame },
  Sol: { glyph: "", smoke: 0.85, glow: 0.28, ramp: SOL, ramp2: SOL, halo: NO_HALO, sparkLift: 0, shape: sun },
  Lux: { glyph: "", smoke: 0.65, glow: 0.34, ramp: LUX, ramp2: LUX, halo: NO_HALO, sparkLift: 0, shape: star },
  Ling: {
    glyph: "灵", smoke: 0.5, glow: 0.34, halo: NO_HALO, sparkLift: 0, shape: spirit,
    ramp: rgb(["#06161c", "#1d4650", "#4a8890", "#8ccfd4", "#c4f0f0", "#ecffff", "#ffffff"]),
    ramp2: rgb(["#100c1e", "#33285a", "#6a5aa0", "#a597d8", "#d6ccf6", "#f3efff", "#ffffff"]),
  },
  Tian: {
    glyph: "天", smoke: 0.22, glow: 0.5, halo: [0.45, 0.75, 1.05], sparkLift: 0, shape: heaven,
    ramp: rgb(["#14110c", "#4a4232", "#8f8466", "#d2c7a6", "#f3e6c4", "#fff4dc", "#fffaf0"]),
    ramp2: rgb(["#100f18", "#3e3c58", "#8481aa", "#c8c6e6", "#ecebff", "#fbfaff", "#ffffff"]),
  },
};
