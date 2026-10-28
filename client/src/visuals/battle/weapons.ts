import {
  attackShape, FIXED_DT, isSwing, type AttackKind, type SwingData, type SwingDir, type Vec3, type Weapon,
} from "@infinite-tower/shared";

/** The trail starts this long before the swing's blade goes live, and shows this long in all (seconds). */
const TRAIL_LEAD_TIME = 0.03;
const TRAIL_DURATION = 0.2;
/** The stab's thrust shows from a little before its blade goes live, out and back over this long (seconds). */
const THRUST_DURATION = 0.16;

/** Each swing's way across the screen as the player sees it (x right, y up), from behind them or facing a foe. */
export const SCREEN_DIR: Record<SwingDir, { x: number; y: number }> = {
  lr: { x: 1, y: 0 }, rl: { x: -1, y: 0 }, tb: { x: 0, y: -1 }, bt: { x: 0, y: 1 },
  tlbr: { x: Math.SQRT1_2, y: -Math.SQRT1_2 }, brtl: { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
  trbl: { x: -Math.SQRT1_2, y: -Math.SQRT1_2 }, bltr: { x: Math.SQRT1_2, y: Math.SQRT1_2 },
};

/** 0 winding up, 1 live, 2 following through. */
export const swingFrame = (swing: SwingData): 0 | 1 | 2 =>
  swing.step < swing.liveAt ? 0 : swing.step < swing.liveUntil ? 1 : 2;

/** Seconds since the blade went live (negative before). */
const sinceLive = (swing: SwingData): number => (swing.step - swing.liveAt) * FIXED_DT;

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

export function trailPose(swing: SwingData | null): TrailPose | null {
  if (!swing || !isSwing(swing.attack)) return null;
  const progress = (sinceLive(swing) + TRAIL_LEAD_TIME) / TRAIL_DURATION;
  if (progress < 0 || progress >= 1) return null;
  return { ...trailLine(swing.attack), reach: Math.min(1, progress * 2.2), visibility: 1 - progress * progress };
}

export interface ThrustPose {
  /** How far out it is (m). */
  reachM: number;
  visibility: number;
}

export function thrustPose(swing: SwingData | null, weapon: Weapon): ThrustPose | null {
  if (!swing || isSwing(swing.attack)) return null;
  const progress = (sinceLive(swing) + TRAIL_LEAD_TIME) / THRUST_DURATION;
  if (progress < 0 || progress >= 1) return null;
  return { reachM: Math.min(1, progress * 3) * attackShape("stab", weapon).range, visibility: 1 - progress * progress };
}

const norm = ({ x, y, z }: Vec3): Vec3 => {
  const l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
};

/** Unit vector in the wielder's frame, +z ahead. */
export interface BladePose { blade: Vec3; handZ: number }

export const GUARD_BLADE: BladePose = { blade: norm({ x: 0.25, y: 0.7, z: 0.65 }), handZ: 0.28 };
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

export function windupBlade(attack: AttackKind, k: number): BladePose {
  const start = swingStart(attack), guard = GUARD_BLADE.blade;
  const to = isSwing(attack) ? { x: start.x, y: start.y, z: WINDUP_LEAN } : STAB_DIR;
  return {
    blade: norm({
      x: guard.x + (to.x - guard.x) * k, y: guard.y + (to.y - guard.y) * k, z: guard.z + (to.z - guard.z) * k,
    }),
    handZ: isSwing(attack) ? GUARD_BLADE.handZ : GUARD_BLADE.handZ - 0.3 * k,
  };
}

export function liveBlade(attack: AttackKind, s: number): BladePose {
  if (!isSwing(attack)) return { blade: STAB_DIR, handZ: GUARD_BLADE.handZ + 0.45 * Math.sin(Math.PI * s) };
  const start = swingStart(attack), a = Math.PI * s;
  const blade = norm({ x: start.x * Math.cos(a), y: start.y * Math.cos(a), z: Math.sin(a) + 0.15 });
  return { blade, handZ: GUARD_BLADE.handZ };
}

/** Radians, in the wielder's frame; a stab has none. */
export function tellArrowRad(attack: AttackKind): number | null {
  if (!isSwing(attack)) return null;
  const { x, y } = SCREEN_DIR[attack];
  return Math.atan2(x, y);
}
