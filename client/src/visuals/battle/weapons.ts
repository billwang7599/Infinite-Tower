import {
  clamp, isSwing, mirrorWay, SCREEN_DIR, WEAPONS, type SwingData, type Vec3, type Way, type WeaponId,
  type WeaponKind,
} from "@infinite-tower/shared";

const LIVE_FRAME_TURN = 0.25;
const FOLLOW_FRAME_TURN = 0.75;
const TRAIL_FROM_TURN = 0.2;
const TRAIL_GROW_TURN = 0.45;

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

export interface TrailPose {
  /** The cut's line on screen, turned from flat (across): positive tips its right end up. */
  rollRad: number;
  /** The end of the line it grows from: 1 its right end, -1 its left. */
  from: 1 | -1;
  /** How far it has grown toward the other end, 0..1. */
  reach: number;
  visibility: number;
}

function trailLine({ x, y }: Cut): { rollRad: number; from: 1 | -1 } {
  const angle = Math.atan2(y, x);
  // Fold the angle into (-90°, 90°]: the line's right end; a cut going leftward starts from that end.
  if (angle > Math.PI / 2 + 1e-9) return { rollRad: angle - Math.PI, from: 1 };
  if (angle <= -Math.PI / 2 + 1e-9) return { rollRad: angle + Math.PI, from: 1 };
  return { rollRad: angle, from: -1 };
}

function trailPose(swing: SwingData | null): TrailPose | null {
  if (!swing || swing.way === "stab") return null;
  const { turn, follow } = strokeOf(swing);
  if (turn < TRAIL_FROM_TURN || follow >= 1) return null;
  return {
    ...trailLine(wayCut(swing.way)), reach: Math.min(1, (turn - TRAIL_FROM_TURN) / TRAIL_GROW_TURN),
    visibility: 1 - follow * follow,
  };
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

function windupBlade(cut: Cut, k: number, from: BladePose): BladePose {
  return { blade: lerpBlade(from.blade, { ...cutStart(cut), z: WINDUP_LEAN }, k), handZ: from.handZ };
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

export interface WeaponMotion {
  trail(swing: SwingData | null): TrailPose | null;
  held(cut: Cut): BladePose;
  windup(cut: Cut, k: number, from: BladePose): BladePose;
  stroke(cut: Cut, turn: number): BladePose;
}

export const MOTIONS: Record<WeaponKind, WeaponMotion> = {
  sword: { trail: trailPose, held: heldBlade, windup: windupBlade, stroke: strokeBlade },
};

/** `blade`: from the guard up; `twoHanded`: a 3D model holds it with its off hand too. */
export interface WeaponLook {
  blade: { lengthM: number; widthM: number; color: string };
  twoHanded: boolean;
  hitStopMs: number;
}

// Lengths are the sword's own share: the sword is drawn 1 long.
const lengthOf = (id: WeaponId): number => WEAPONS[id].length / WEAPONS.sword.length;

export const WEAPON_LOOKS: Record<WeaponId, WeaponLook> = {
  sword: { blade: { lengthM: 1, widthM: 0.07, color: "#c9d1d8" }, twoHanded: false, hitStopMs: 60 },
  "kobold-blade": { blade: { lengthM: 1, widthM: 0.07, color: "#c9d1d8" }, twoHanded: false, hitStopMs: 60 },
  longsword: {
    blade: { lengthM: lengthOf("longsword"), widthM: 0.075, color: "#c9d1d8" }, twoHanded: false, hitStopMs: 90,
  },
  greatsword: {
    blade: { lengthM: lengthOf("greatsword"), widthM: 0.12, color: "#b4bcc4" }, twoHanded: true, hitStopMs: 130,
  },
  "kobold-greatsword": {
    blade: { lengthM: lengthOf("kobold-greatsword"), widthM: 0.13, color: "#8f9196" }, twoHanded: true,
    hitStopMs: 130,
  },
};
