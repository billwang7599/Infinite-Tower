import { Color3, Color4 } from "@babylonjs/core";
import type { SpellElement } from "@infinite-tower/shared";

export type LookKey = SpellElement | "none";
export type ParticleKey = LookKey | "steam";

export interface ShaderLook {
  // Above 1 so the bloom catches it.
  core: Color3;
  edge: Color3;
  // How much the noise breaks the shape up (0 smooth, 1 ragged), and how fast it moves.
  rough: number;
  flowPerSec: number;
  // Drawn over what's behind (smoke) instead of adding light to it.
  dark?: boolean;
}

export interface ParticleLook {
  colors: [Color4, Color4, Color4];
  sizeM: [number, number];
  lifeS: [number, number];
  speedMps: [number, number];
  gravityMps2: number;
  smoke?: boolean;
}

const c3 = (r: number, g: number, b: number) => new Color3(r, g, b);
const c4 = (r: number, g: number, b: number, a: number) => new Color4(r, g, b, a);

export const SHADER_LOOKS: Record<LookKey, ShaderLook> = {
  fire: { core: c3(2.2, 0.85, 0.15), edge: c3(1.1, 0.22, 0.04), rough: 0.75, flowPerSec: 2.2 },
  water: { core: c3(0.35, 1, 2.3), edge: c3(0.08, 0.3, 0.9), rough: 0.45, flowPerSec: 0.9 },
  earth: { core: c3(1.1, 0.6, 0.25), edge: c3(0.3, 0.17, 0.07), rough: 0.85, flowPerSec: 0.35 },
  air: { core: c3(0.95, 1.9, 1.6), edge: c3(0.35, 0.65, 0.7), rough: 0.6, flowPerSec: 3 },
  lightning: { core: c3(1.8, 1.6, 0.35), edge: c3(0.55, 0.45, 1.6), rough: 0.9, flowPerSec: 6 },
  light: { core: c3(2, 1.7, 0.8), edge: c3(1.2, 0.9, 0.4), rough: 0.25, flowPerSec: 0.6 },
  darkness: { core: c3(0.04, 0, 0.08), edge: c3(0.55, 0.12, 0.9), rough: 0.7, flowPerSec: 0.8, dark: true },
  none: { core: c3(1.25, 1, 2.1), edge: c3(0.4, 0.35, 0.75), rough: 0.4, flowPerSec: 1.2 },
};

export const PARTICLE_LOOKS: Record<ParticleKey, ParticleLook> = {
  fire: {
    colors: [c4(1, 0.75, 0.25, 1), c4(1, 0.3, 0.05, 1), c4(0.3, 0.05, 0, 0)],
    sizeM: [0.12, 0.35], lifeS: [0.3, 0.7], speedMps: [0.5, 1.5], gravityMps2: 5,
  },
  water: {
    colors: [c4(0.6, 0.85, 1, 0.9), c4(0.2, 0.5, 1, 0.8), c4(0.1, 0.2, 0.6, 0)],
    sizeM: [0.06, 0.16], lifeS: [0.4, 0.8], speedMps: [1, 2.5], gravityMps2: -9,
  },
  earth: {
    colors: [c4(0.55, 0.42, 0.28, 0.9), c4(0.4, 0.3, 0.2, 0.7), c4(0.3, 0.24, 0.18, 0)],
    sizeM: [0.08, 0.3], lifeS: [0.5, 1], speedMps: [0.5, 2], gravityMps2: -6, smoke: true,
  },
  air: {
    colors: [c4(0.85, 1, 1, 0.5), c4(0.6, 0.9, 0.95, 0.35), c4(0.5, 0.8, 0.9, 0)],
    sizeM: [0.2, 0.5], lifeS: [0.25, 0.5], speedMps: [3, 6], gravityMps2: 0,
  },
  lightning: {
    colors: [c4(1, 1, 0.8, 1), c4(0.7, 0.6, 1, 1), c4(0.4, 0.3, 1, 0)],
    sizeM: [0.04, 0.12], lifeS: [0.1, 0.3], speedMps: [3, 7], gravityMps2: -3,
  },
  light: {
    colors: [c4(1, 0.95, 0.8, 1), c4(1, 0.85, 0.5, 0.8), c4(1, 0.8, 0.4, 0)],
    sizeM: [0.08, 0.22], lifeS: [0.5, 1.1], speedMps: [0.2, 0.8], gravityMps2: 1.5,
  },
  darkness: {
    colors: [c4(0.12, 0.02, 0.2, 0.85), c4(0.25, 0.05, 0.4, 0.6), c4(0.05, 0, 0.1, 0)],
    sizeM: [0.25, 0.6], lifeS: [0.5, 1], speedMps: [0.3, 1], gravityMps2: 0.8, smoke: true,
  },
  none: {
    colors: [c4(0.85, 0.85, 1, 0.9), c4(0.55, 0.5, 1, 0.6), c4(0.3, 0.25, 0.7, 0)],
    sizeM: [0.06, 0.16], lifeS: [0.4, 0.8], speedMps: [0.3, 1], gravityMps2: 0.5,
  },
  steam: {
    colors: [c4(0.95, 0.97, 1, 0.55), c4(0.8, 0.85, 0.9, 0.35), c4(0.7, 0.75, 0.8, 0)],
    sizeM: [0.4, 0.9], lifeS: [0.7, 1.3], speedMps: [0.5, 1.5], gravityMps2: 2.5, smoke: true,
  },
};

export const lookOf = (elements: readonly SpellElement[]): LookKey => elements[0] ?? "none";
export const particleKeysOf = (elements: readonly SpellElement[]): ParticleKey[] =>
  elements.length === 0 ? ["none"] : [...elements];
