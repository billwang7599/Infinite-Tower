import {
  clamp, isSwing, SCREEN_DIR, strokeOf, WEAPONS, type AttackKind, type Blade, type SwingData, type SwingDir, type Vec3,
  type WeaponId, type WeaponKind,
} from "@infinite-tower/shared";
import type { Art } from "../../gfx/look/art.js";
import { SWORD, swordArt } from "../../gfx/look/sword.js";

/** In shares of a stroke's half-turn: frames switch, and the trail and thrust show, from these. */
const LIVE_FRAME_TURN = 0.25;
const FOLLOW_FRAME_TURN = 0.75;
const TRAIL_FROM_TURN = 0.2;
const TRAIL_GROW_TURN = 0.45;

export function swingFrame(swing: SwingData): 0 | 1 | 2 {
  const { turn } = strokeOf(swing);
  return turn < LIVE_FRAME_TURN ? 0 : turn < FOLLOW_FRAME_TURN ? 1 : 2;
}

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
  if (!swing || !isSwing(swing.attack) || swing.stoppedAt !== null) return null;
  const { turn, follow } = strokeOf(swing);
  if (turn < TRAIL_FROM_TURN || follow >= 1) return null;
  return {
    ...trailLine(swing.attack), reach: Math.min(1, (turn - TRAIL_FROM_TURN) / TRAIL_GROW_TURN),
    visibility: 1 - follow * follow,
  };
}

export interface ThrustPose {
  /** How far out it is (m). */
  reachM: number;
  visibility: number;
}

function thrustPose(swing: SwingData | null, stabRangeM: number): ThrustPose | null {
  if (!swing || isSwing(swing.attack)) return null;
  const { turn, follow } = strokeOf(swing);
  if (turn < TRAIL_FROM_TURN || follow >= 1) return null;
  const reach = Math.min(1, (turn - TRAIL_FROM_TURN) / TRAIL_GROW_TURN);
  return { reachM: reach * stabRangeM, visibility: 1 - follow * follow };
}

const norm = ({ x, y, z }: Vec3): Vec3 => {
  const l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
};

/** Unit vector in the wielder's frame, +z ahead. */
export interface BladePose { blade: Vec3; handZ: number }

const GUARD_BLADE: BladePose = { blade: norm({ x: 0.25, y: 0.7, z: 0.65 }), handZ: 0.28 };
/** The blade drawn back before a stab, and as it thrusts. */
const STAB_DIR = norm({ x: 0, y: 0.08, z: 1 });
/** How far forward (m) a wound-up blade leans, on either side of its swing. */
const WINDUP_LEAN = 0.35;
const STROKE_LEAN = 0.15;

const lerp = (a: Vec3, b: Vec3, k: number): Vec3 => norm({
  x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k,
});

/** Where the blade is held at rest: the guard at the fight's blade 0, where a stroke ends at its ends. */
function heldBlade(at: Blade): BladePose {
  const out = Math.min(1, Math.hypot(at.x, at.y));
  return { blade: lerp(GUARD_BLADE.blade, norm({ x: -at.x, y: at.y, z: STROKE_LEAN }), out), handZ: GUARD_BLADE.handZ };
}

/** Seen from in front, so the wielder's x is the screen's mirrored. */
function swingStart(attack: AttackKind): Vec3 {
  if (!isSwing(attack)) return STAB_DIR;
  const { x, y } = SCREEN_DIR[attack];
  return { x, y: -y, z: 0 };
}

function windupBlade(attack: AttackKind, k: number, from: BladePose): BladePose {
  const start = swingStart(attack);
  const to = isSwing(attack) ? { x: start.x, y: start.y, z: WINDUP_LEAN } : STAB_DIR;
  return { blade: lerp(from.blade, to, k), handZ: isSwing(attack) ? from.handZ : from.handZ - 0.3 * k };
}

/** `turn` as in strokeOf; past 1 it runs on. */
function strokeBlade(attack: AttackKind, turn: number): BladePose {
  if (!isSwing(attack)) {
    const a = Math.PI * Math.min(1, turn), back = clamp(3 * turn - 2, 0, 1);
    const handZ = GUARD_BLADE.handZ + (turn < 0.5 ? 0.75 * Math.sin(a) - 0.3 : 0.45 * Math.sin(a));
    return { blade: back > 0 ? lerp(STAB_DIR, GUARD_BLADE.blade, back) : STAB_DIR, handZ };
  }
  const start = swingStart(attack), a = Math.PI * turn;
  const blade = norm({ x: start.x * Math.cos(a), y: start.y * Math.cos(a), z: Math.sin(a) + STROKE_LEAN });
  return { blade, handZ: GUARD_BLADE.handZ };
}

export interface WeaponMotion {
  trail(swing: SwingData | null): TrailPose | null;
  thrust(swing: SwingData | null, stabRangeM: number): ThrustPose | null;
  held(at: Blade): BladePose;
  windup(attack: AttackKind, k: number, from: BladePose): BladePose;
  stroke(attack: AttackKind, turn: number): BladePose;
}

export const MOTIONS: Record<WeaponKind, WeaponMotion> = {
  sword: {
    trail: trailPose, thrust: thrustPose, held: heldBlade, windup: windupBlade, stroke: strokeBlade,
  },
};

/** `blade`: a 3D model's, from the guard up; `twoHanded`: a 3D model holds it with its off hand too. */
export interface WeaponLook {
  sprite: Art;
  blade: { lengthM: number; widthM: number; color: string };
  twoHanded: boolean;
  hitStopMs: number;
}

// Lengths are the sword's own share: the models' and the sprite's sword is drawn 1 long.
const lengthOf = (id: WeaponId): number => WEAPONS[id].length / WEAPONS.sword.length;
const LONGSWORD = swordArt({ lengthScale: lengthOf("longsword"), bladeHalfPx: 1.6 });
const GREATSWORD = swordArt({ lengthScale: lengthOf("greatsword"), bladeHalfPx: 2.3 });

export const WEAPON_LOOKS: Record<WeaponId, WeaponLook> = {
  sword: { sprite: SWORD, blade: { lengthM: 1, widthM: 0.07, color: "#c9d1d8" }, twoHanded: false, hitStopMs: 60 },
  "kobold-blade": {
    sprite: SWORD, blade: { lengthM: 1, widthM: 0.07, color: "#c9d1d8" }, twoHanded: false, hitStopMs: 60,
  },
  longsword: {
    sprite: LONGSWORD, blade: { lengthM: lengthOf("longsword"), widthM: 0.075, color: "#c9d1d8" }, twoHanded: false,
    hitStopMs: 90,
  },
  greatsword: {
    sprite: GREATSWORD, blade: { lengthM: lengthOf("greatsword"), widthM: 0.12, color: "#b4bcc4" }, twoHanded: true,
    hitStopMs: 130,
  },
  "kobold-greatsword": {
    sprite: GREATSWORD, blade: { lengthM: lengthOf("kobold-greatsword"), widthM: 0.13, color: "#8f9196" },
    twoHanded: true, hitStopMs: 130,
  },
};
