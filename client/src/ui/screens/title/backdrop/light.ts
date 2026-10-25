/**
 * How the title's scene is lit: one colour per face, worked out like a shader would, for flat-shaded polygons
 * that still read as lit. It's night: a dim, cold moon, a little cold light from the sky and nearly none off the
 * ground, so the world is dark and gloomy, and the tower is the light in it: it glows, and lights the floor round it
 * warm. A glint where a face mirrors the moon, a cold rim where a face turns away. Fog two ways: with distance into
 * the dark, and with height above the eye into light (the tower goes up into it). Worked in linear light,
 * tone-mapped, then back to sRGB.
 */
import { dot, length, normalize, scale, sub, type Vec3 } from "./space.js";

export interface Material {
  /** Linear RGB, from linear(). */
  color: Vec3;
  /** 1 is solid. */
  alpha: number;
  /** How bright the moon's glint is, and how tight (higher is tighter). */
  shine: number;
  gloss: number;
  /** Light of its own. */
  glow: number;
  /** Also drawn into the glow layer, which the screen blurs over the scene. */
  bloom?: boolean;
  /** An outline, as a CSS colour, if any. */
  edge?: string;
}

/** An sRGB hex colour as linear RGB. */
export function linear(hex: string): Vec3 {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => (c / 255) ** 2.2) as unknown as Vec3;
}
const times = (c: Vec3, k: number): Vec3 => scale(c, k);

/** Toward the moon: high, from the left and behind the tower, as seen from the title, so its shadow falls our way. */
export const SUN_DIR = normalize([-0.55, 0.7, 0.5]);
const MOON = times(linear("#aebfff"), 0.55);
const SKY = linear("#26314a");
const GROUND = linear("#0d0c0b");
const AMBIENT = 0.35;
const RIM = times(linear("#6f86b8"), 0.22);
/** The tower's light on what's round it: warm, from up its middle, falling off with distance. */
const TOWER_LIGHT = times(linear("#ffd28a"), 6);
const TOWER_LIGHT_ABOVE = 3.5;
const TOWER_LIGHT_FALLOFF = 0.3;
/** Everything's light is scaled by this before tone mapping: lower is darker, with more colour left in. */
const EXPOSURE = 1;

/** What distance fades into, and what height fades into. */
const DARK = linear("#050609");
const LIGHT = linear("#fff8ea");
/** Fog per unit of distance, and the heights above the eye where the light starts and is total. */
const FOG_DENSITY = 0.045;
const HEIGHT_FOG: readonly [number, number] = [4, 15];

export interface Fog {
  dark: number;
  light: number;
}

/** How far a point has faded into the dark and into the light, 0 to 1 each. */
export function fogAt(point: Vec3, eye: Vec3): Fog {
  const rise = (point[1] - eye[1] - HEIGHT_FOG[0]) / (HEIGHT_FOG[1] - HEIGHT_FOG[0]);
  return {
    dark: 1 - Math.exp(-length(sub(point, eye)) * FOG_DENSITY),
    light: smooth(Math.min(1, Math.max(0, rise))),
  };
}

/** The colour of a face of `m` facing `normal` at `center`, seen from `eye`, before fog. */
export function lit(m: Material, normal: Vec3, center: Vec3, eye: Vec3): Vec3 {
  const toEye = normalize(sub(eye, center));
  const n = dot(normal, toEye) < 0 ? scale(normal, -1) : normal;
  const moon = Math.max(0, dot(n, SUN_DIR));
  const skyward = n[1] * 0.5 + 0.5;
  const half = normalize([SUN_DIR[0] + toEye[0], SUN_DIR[1] + toEye[1], SUN_DIR[2] + toEye[2]]);
  const glint = m.shine * Math.max(0, dot(n, half)) ** m.gloss;
  const rim = (1 - Math.max(0, dot(n, toEye))) ** 3;
  const toTower = sub([0, center[1] + TOWER_LIGHT_ABOVE, 0], center);
  const tower = Math.max(0, dot(n, normalize(toTower))) / (1 + TOWER_LIGHT_FALLOFF * dot(toTower, toTower));
  return [0, 1, 2].map((i) => {
    const ambient = GROUND[i]! + (SKY[i]! - GROUND[i]!) * skyward;
    const light = MOON[i]! * moon + TOWER_LIGHT[i]! * tower + ambient * AMBIENT + m.glow;
    return EXPOSURE * (m.color[i]! * light + MOON[i]! * glint + RIM[i]! * rim);
  }) as unknown as Vec3;
}

/** `color` fogged by `fog`, as a CSS colour with `alpha`. */
export function css(color: Vec3, fog: Fog, alpha: number): string {
  const [r, g, b] = color.map((c, i) => {
    const near = toneMap(c);
    const dimmed = near + (DARK[i]! - near) * fog.dark;
    return srgb(dimmed + (LIGHT[i]! - dimmed) * fog.light);
  });
  return `rgb(${r} ${g} ${b} / ${alpha.toFixed(3)})`;
}

/** How much of a face is left to see under `fog`: none, once it's all dark or all light. */
export const seenThrough = (fog: Fog): number => Math.min(1 - fog.dark, 1 - fog.light);

const smooth = (t: number) => t * t * (3 - 2 * t);
/** Filmic (ACES, fitted): brights roll off instead of clipping. */
const toneMap = (x: number) => Math.min(1, (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14));
const srgb = (c: number) => Math.round(255 * Math.min(1, Math.max(0, c)) ** (1 / 2.2));
