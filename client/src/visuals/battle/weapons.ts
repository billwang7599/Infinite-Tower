import {
  isSwing, SCREEN_DIR, type AttackKind, type SwingData, type SwingDir, type Vec3, type WeaponId, type WeaponKind,
} from "@infinite-tower/shared";
import type { Art } from "../../gfx/look/art.js";
import { SWORD } from "../../gfx/look/sword.js";

/** In shares of the swing's live time. */
const TRAIL_LEAD = 0.3;
const TRAIL_DURATION = 2;
const THRUST_DURATION = 1.6;

/** 0 winding up, 1 live, 2 following through. */
export const swingFrame = (swing: SwingData): 0 | 1 | 2 =>
  swing.step < swing.liveAt ? 0 : swing.step < swing.liveUntil ? 1 : 2;

const throughLive = (swing: SwingData): number => (swing.step - swing.liveAt) / (swing.liveUntil - swing.liveAt);

export interface TrailPose {
  /** The cut's line on screen, turned from flat (across): positive tips its right end up. */
  rollRad: number;
  /** The end of the line it grows from: 1 its right end, -1 its left. */
  from: 1 | -1;
  /** How far it has grown toward the other end, 0..1. */
  reach: number;
  visibility: number;
}

/** The trail's line and the end it starts from (+1: the right end), from the swing's way across the screen. */
function trailLine(dir: SwingDir): { rollRad: number; from: 1 | -1 } {
  const { x, y } = SCREEN_DIR[dir];
  const angle = Math.atan2(y, x);
  // Fold the angle into (-90°, 90°]: the line's right end; a swing going leftward starts from that end.
  if (angle > Math.PI / 2 + 1e-9) return { rollRad: angle - Math.PI, from: 1 };
  if (angle <= -Math.PI / 2 + 1e-9) return { rollRad: angle + Math.PI, from: 1 };
  return { rollRad: angle, from: -1 };
}

function trailPose(swing: SwingData | null): TrailPose | null {
  if (!swing || !isSwing(swing.attack)) return null;
  const progress = (throughLive(swing) + TRAIL_LEAD) / TRAIL_DURATION;
  if (progress < 0 || progress >= 1) return null;
  return { ...trailLine(swing.attack), reach: Math.min(1, progress * 2.2), visibility: 1 - progress * progress };
}

export interface ThrustPose {
  /** How far out it is (m). */
  reachM: number;
  visibility: number;
}

function thrustPose(swing: SwingData | null, stabRangeM: number): ThrustPose | null {
  if (!swing || isSwing(swing.attack)) return null;
  const progress = (throughLive(swing) + TRAIL_LEAD) / THRUST_DURATION;
  if (progress < 0 || progress >= 1) return null;
  return { reachM: Math.min(1, progress * 3) * stabRangeM, visibility: 1 - progress * progress };
}

const norm = ({ x, y, z }: Vec3): Vec3 => {
  const l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
};

/** Unit vector in the wielder's frame, +z ahead. */
export interface BladePose { blade: Vec3; handZ: number }

const GUARD_BLADE: BladePose = { blade: norm({ x: 0.25, y: 0.7, z: 0.65 }), handZ: 0.28 };
/** The blade as it ends a stab, and drawn back before one. */
const STAB_DIR = norm({ x: 0, y: 0.08, z: 1 });
/** How far forward (m) a wound-up blade leans, on either side of its swing. */
const WINDUP_LEAN = 0.35;

/** Seen from in front, so the wielder's x is the screen's mirrored. */
function swingStart(attack: AttackKind): Vec3 {
  if (!isSwing(attack)) return STAB_DIR;
  const { x, y } = SCREEN_DIR[attack];
  return { x, y: -y, z: 0 };
}

function windupBlade(attack: AttackKind, k: number): BladePose {
  const start = swingStart(attack), guard = GUARD_BLADE.blade;
  const to = isSwing(attack) ? { x: start.x, y: start.y, z: WINDUP_LEAN } : STAB_DIR;
  return {
    blade: norm({
      x: guard.x + (to.x - guard.x) * k, y: guard.y + (to.y - guard.y) * k, z: guard.z + (to.z - guard.z) * k,
    }),
    handZ: isSwing(attack) ? GUARD_BLADE.handZ : GUARD_BLADE.handZ - 0.3 * k,
  };
}

function liveBlade(attack: AttackKind, s: number): BladePose {
  if (!isSwing(attack)) return { blade: STAB_DIR, handZ: GUARD_BLADE.handZ + 0.45 * Math.sin(Math.PI * s) };
  const start = swingStart(attack), a = Math.PI * s;
  const blade = norm({ x: start.x * Math.cos(a), y: start.y * Math.cos(a), z: Math.sin(a) + 0.15 });
  return { blade, handZ: GUARD_BLADE.handZ };
}

/** Radians, in the wielder's frame; a stab has none. */
function tellArrowRad(attack: AttackKind): number | null {
  if (!isSwing(attack)) return null;
  const { x, y } = SCREEN_DIR[attack];
  return Math.atan2(x, y);
}

export interface WeaponMotion {
  trail(swing: SwingData | null): TrailPose | null;
  thrust(swing: SwingData | null, stabRangeM: number): ThrustPose | null;
  guard: BladePose;
  windup(attack: AttackKind, k: number): BladePose;
  live(attack: AttackKind, s: number): BladePose;
  tellArrowRad(attack: AttackKind): number | null;
}

export const MOTIONS: Record<WeaponKind, WeaponMotion> = {
  sword: {
    trail: trailPose, thrust: thrustPose, guard: GUARD_BLADE, windup: windupBlade, live: liveBlade, tellArrowRad,
  },
};

/** `blade`: a 3D model's, from the guard up. */
export interface WeaponLook {
  sprite: Art;
  blade: { lengthM: number; widthM: number; color: string };
}

export const WEAPON_LOOKS: Record<WeaponId, WeaponLook> = {
  sword: { sprite: SWORD, blade: { lengthM: 1, widthM: 0.07, color: "#c9d1d8" } },
  "kobold-blade": { sprite: SWORD, blade: { lengthM: 1, widthM: 0.07, color: "#c9d1d8" } },
};
