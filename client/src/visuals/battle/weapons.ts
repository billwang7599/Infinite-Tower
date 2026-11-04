import {
  clamp, FIXED_DT, isSwing, mirrorWay, SCREEN_DIR, WEAPONS, type SwingData, type Vec3, type Way, type WeaponId,
  type WeaponKind,
} from "@infinite-tower/shared";
import type { Art } from "../../gfx/look/art.js";
import { SWORD } from "../../gfx/look/sword.js";

const LIVE_FRAME_TURN = 0.25;
const FOLLOW_FRAME_TURN = 0.75;
const TRAIL_FROM_TURN = 0.2;

export interface Cut { x: number; y: number }

const STAB_CUT: Cut = { x: 0, y: 0 };

export function wayCut(way: Way, facing = false): Cut {
  const seen = facing ? mirrorWay(way) : way;
  return isSwing(seen) ? SCREEN_DIR[seen] : STAB_CUT;
}


export function strokeOf(swing: SwingData): { set: number; turn: number; follow: number } {
  const { step, driveAt, liveAt, liveUntil, endAt } = swing;
  if (step < driveAt) return { set: step / driveAt, turn: 0, follow: 0 };
  if (step < liveAt) {
    const s = (step - driveAt) / (liveAt - driveAt);
    return { set: 1, turn: (s * s) / 3, follow: 0 };
  }
  if (step < liveUntil) return { set: 1, turn: (1 + (step - liveAt) / (liveUntil - liveAt)) / 3, follow: 0 };
  const f = clamp((step - liveUntil) / Math.max(1, endAt - liveUntil), 0, 1);
  return { set: 1, turn: (2 + f * (2 - f)) / 3, follow: f };
}

export function swingFrame(swing: SwingData): 0 | 1 | 2 {
  const { turn } = strokeOf(swing);
  return turn < LIVE_FRAME_TURN ? 0 : turn < FOLLOW_FRAME_TURN ? 1 : 2;
}

/** The trail left behind the blade, 0..1, fading over the follow-through; null when there's none. */
function trailOf(swing: SwingData | null): number | null {
  if (!swing || swing.way === "stab") return null;
  const { turn, follow } = strokeOf(swing);
  return turn < TRAIL_FROM_TURN || follow >= 1 ? null : 1 - follow * follow;
}

const norm = ({ x, y, z }: Vec3): Vec3 => {
  const l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
};

/** Unit vector in the wielder's frame, +z ahead. */
export interface BladePose { blade: Vec3; handZ: number }

export const REST_BLADE: BladePose = { blade: norm({ x: 0.25, y: 0.7, z: 0.65 }), handZ: 0.28 };
export const REELING_BLADE = norm({ x: 0.6, y: -0.5, z: -0.2 });
const GUARD_OUT = 0.8;
/** How far forward (m) a wound-up blade leans, on either side of its swing. */
const WINDUP_LEAN = 0.35;
const STROKE_LEAN = 0.15;

const lerpBlade = (a: Vec3, b: Vec3, k: number): Vec3 => norm({
  x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k,
});

/** Seen from in front, so the wielder's x is the screen's mirrored. */
const cutStart = ({ x, y }: Cut): Vec3 => ({ x, y: -y, z: 0 });

function heldBlade(cut: Cut): BladePose {
  const start = cutStart(cut);
  return { blade: lerpBlade(REST_BLADE.blade, { ...start, z: STROKE_LEAN }, GUARD_OUT), handZ: REST_BLADE.handZ };
}

const STAB_HAND_Z = -0.3;

function windupBlade(cut: Cut, k: number, from: BladePose): BladePose {
  const stab = cut.x === 0 && cut.y === 0, handZ = stab ? from.handZ + (STAB_HAND_Z - from.handZ) * k : from.handZ;
  return { blade: lerpBlade(from.blade, { ...cutStart(cut), z: WINDUP_LEAN }, k), handZ };
}

/** `turn` as in strokeOf; past 1 it runs on. */
function strokeBlade(cut: Cut, turn: number): BladePose {
  const start = cutStart(cut), a = Math.PI * turn;
  const blade = norm({ x: start.x * Math.cos(a), y: start.y * Math.cos(a), z: Math.sin(a) + STROKE_LEAN });
  return { blade, handZ: REST_BLADE.handZ };
}

/**
 * Drawn wider than the motion so it reads: a swing's blade turns `swingRad` further back past its start, eased off
 * by `goneByTurn`, the turn a stroke goes live on; a heavy's `heavyFactor` times as far.
 */
export const DRAWBACK = { swingRad: 1.1, goneByTurn: 1 / 3, heavyFactor: 1.6 };

const smooth = (s: number): number => s * s * (3 - 2 * s);

export function pullOf(stroke: { set: number; turn: number }, heavy: boolean): number {
  const pull = stroke.set < 1 ? smooth(stroke.set) : 1 - smooth(clamp(stroke.turn / DRAWBACK.goneByTurn, 0, 1));
  return pull * (heavy ? DRAWBACK.heavyFactor : 1);
}

/** Further round its swing's arc, away from where it sweeps to. */
export function drawnBack(blade: Vec3, pull: number): Vec3 {
  const flat = Math.hypot(blade.x, blade.y);
  if (pull <= 0 || flat < 1e-6) return blade;
  const a = Math.atan2(blade.z, flat) - DRAWBACK.swingRad * pull, out = Math.cos(a) / flat;
  return { x: blade.x * out, y: blade.y * out, z: Math.sin(a) };
}

const GLINT_LEAD_STEPS = Math.round(0.15 / FIXED_DT);
const GLINT_FADE_STEPS = Math.round(0.05 / FIXED_DT);

export function glintOf(swing: SwingData | null): number {
  if (!swing) return 0;
  const { step, liveAt } = swing;
  return Math.max(0, step <= liveAt ? 1 - (liveAt - step) / GLINT_LEAD_STEPS : 1 - (step - liveAt) / GLINT_FADE_STEPS);
}

export interface WeaponMotion {
  /** Held with no way aimed. */
  rest: BladePose;
  trail(swing: SwingData | null): number | null;
  held(cut: Cut): BladePose;
  windup(cut: Cut, k: number, from: BladePose): BladePose;
  stroke(cut: Cut, turn: number): BladePose;
}

// A bow's "blade" is its stave; it never swings.
const BOW_REST: BladePose = { blade: norm({ x: 0.2, y: 0.8, z: 0.55 }), handZ: 0.1 };
const BOW_GUARD: BladePose = { blade: norm({ x: -0.85, y: 0.45, z: 0.25 }), handZ: REST_BLADE.handZ };

export const MOTIONS: Record<WeaponKind, WeaponMotion> = {
  sword: { rest: REST_BLADE, trail: trailOf, held: heldBlade, windup: windupBlade, stroke: strokeBlade },
  bow: { rest: BOW_REST, trail: () => null, held: () => BOW_GUARD, windup: () => BOW_GUARD, stroke: () => BOW_GUARD },
};

/**
 * `blade`: from the guard up, or a bow's stave, tip to tip; `art`: painted on its faces, else plain `color`;
 * `twoHanded`: a 3D model holds it with its off hand too (a bow's on the string). `bow`: its string `braceM` behind the
 * grip, pulled `drawM` further fully drawn.
 */
export interface WeaponLook {
  blade: { lengthM: number; widthM: number; color: string };
  art: Art | null;
  twoHanded: boolean;
  hitStopMs: number;
  bow?: BowLook;
}
export interface BowLook { braceM: number; drawM: number; string: string }

// Lengths are the sword's own share: the sword is drawn 1 long.
const lengthOf = (id: WeaponId): number => WEAPONS[id].length / WEAPONS.sword.length;

export const WEAPON_LOOKS: Record<WeaponId, WeaponLook> = {
  "old-stick": {
    blade: { lengthM: lengthOf("old-stick"), widthM: 0.07, color: "#7a5a3a" }, art: null, twoHanded: false,
    hitStopMs: 50,
  },
  sword: { blade: { lengthM: 1, widthM: 0.1, color: "#c9d1d8" }, art: SWORD, twoHanded: false, hitStopMs: 60 },
  "kobold-blade": {
    blade: { lengthM: 1, widthM: 0.1, color: "#c9d1d8" }, art: SWORD, twoHanded: false, hitStopMs: 60,
  },
  longsword: {
    blade: { lengthM: lengthOf("longsword"), widthM: 0.105, color: "#c9d1d8" }, art: SWORD, twoHanded: false,
    hitStopMs: 90,
  },
  greatsword: {
    blade: { lengthM: lengthOf("greatsword"), widthM: 0.15, color: "#b4bcc4" }, art: SWORD, twoHanded: true,
    hitStopMs: 130,
  },
  "kobold-greatsword": {
    blade: { lengthM: lengthOf("kobold-greatsword"), widthM: 0.16, color: "#8f9196" }, art: SWORD, twoHanded: true,
    hitStopMs: 130,
  },
  "training-bow": {
    blade: { lengthM: lengthOf("training-bow"), widthM: 0.04, color: "#9a7448" }, art: null, twoHanded: true,
    hitStopMs: 40, bow: { braceM: 0.14, drawM: 0.3, string: "#e6dcc0" },
  },
};
