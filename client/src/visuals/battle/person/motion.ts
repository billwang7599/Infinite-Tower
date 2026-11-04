import { clamp, PLAYER, smoothstep, type Look, type Vec2, type Vec3 } from "@infinite-tower/shared";
import { restAt, restInModel } from "./skeleton.js";

/**
 * A full run's stride from the left foot's contact, in shares of it. The right leg and arm play the left's keys half a
 * stride later; `arm` in metres ahead.
 */
export const WALK = {
  at: [0, 0.25, 0.5, 0.75],
  /** Of each quarter, the share spent easing into its key; the rest holds it. */
  easeShare: 0.6,
  hips: [0.14, 0, -0.14, 0],
  chest: [-0.24, 0, 0.24, 0],
  neck: [0.1, 0, -0.1, 0],
  arm: [-0.11, 0, 0.11, 0],
  leanRad: 0.14,
} as const;

export function walkKey(share: number, keys: readonly number[]): number {
  const s = share - Math.floor(share), quarter = 1 / WALK.at.length;
  let i = WALK.at.length - 1;
  while (i > 0 && WALK.at[i]! > s) i--;
  const from = keys[(i + keys.length - 1) % keys.length]!, to = keys[i]!;
  return from + (to - from) * smoothstep(0, WALK.easeShare * quarter, s - WALK.at[i]!);
}

/** `halfM`: a foot lands this far (m) ahead of the hip at a full stride; `duty`: the share of a stride it's down. */
export const STRIDE = {
  halfM: 0.16, fullAtSpeed: 2, dutyStill: 0.62, dutyRun: 0.22, sideShare: 0.55, liftShare: 0.45, bobShare: 0.08,
  reachShare: 0.97, toeRad: 0.35,
} as const;

export interface Stride { halfM: number; duty: number; cyclesPerSec: number }

/** `side`: 0 going ahead or back, 1 straight sideways. */
export function strideOf(speed: number, side: number): Stride {
  const k = clamp(speed / PLAYER.moveSpeed, 0, 1);
  const duty = STRIDE.dutyStill + (STRIDE.dutyRun - STRIDE.dutyStill) * k;
  const halfM = STRIDE.halfM * Math.sqrt(clamp(speed / STRIDE.fullAtSpeed, 0, 1))
    * (1 - (1 - STRIDE.sideShare) * clamp(side, 0, 1));
  return { halfM, duty, cyclesPerSec: halfM > 0 ? (duty * speed) / (2 * halfM) : 0 };
}

/** `along` the way it goes (m, from under the hip), `lift` off the ground, `swing` 0..1 of the way forward. */
export function footOnStride(share: number, s: Stride): { along: number; lift: number; swing: number } {
  const t = share - Math.floor(share);
  if (t < s.duty) return { along: s.halfM * (1 - (2 * t) / s.duty), lift: 0, swing: 0 };
  const u = (t - s.duty) / (1 - s.duty);
  return {
    along: s.halfM * (2 * smoothstep(0, 1, u) - 1), lift: STRIDE.liftShare * s.halfM * Math.sin(Math.PI * u), swing: u,
  };
}

/** The thigh's x and z and the knee's bend (radians, Babylon's Euler) putting the ankle at `to`, in the hips' frame. */
export function legAngles(to: Vec3, thighM: number, shinM: number): { thighX: number; thighZ: number; shinX: number } {
  const length = clamp(Math.hypot(to.x, to.y, to.z), Math.abs(thighM - shinM) + 1e-6, thighM + shinM - 1e-9);
  const inside = clamp((thighM ** 2 + shinM ** 2 - length ** 2) / (2 * thighM * shinM), -1, 1);
  const shinX = Math.PI - Math.acos(inside);
  const py = -(thighM + shinM * Math.cos(shinX)), pz = -shinM * Math.sin(shinX);
  const sinZ = clamp(to.x / -py, -1, 1), q = py * Math.sqrt(1 - sinZ * sinZ);
  const thighX = Math.atan2(to.z, to.y) - Math.atan2(pz, q);
  return { thighX: Math.atan2(Math.sin(thighX), Math.cos(thighX)), thighZ: Math.asin(sinZ), shinX };
}

const THIGH_M = -restAt("shin.R", "medium").y, SHIN_M = -restAt("foot.R", "medium").y;
const HIP_Y = restAt("hips", "medium").y, ANKLE_Y = restInModel("foot.R", "medium").y;
type LegJoints = Record<"root" | "hips" | `${"thigh" | "shin" | "foot"}.${"R" | "L"}`, Vec3>;

/** Reads the lean and the hips' turn already in `joints`; `way` is in the model's frame. Returns the root's height. */
export function plantLegs(
  joints: LegJoints, share: number, s: Stride, way: Vec2, body: Look["body"], dipM = 0,
): number {
  const lean = joints.root.x, twist = joints.hips.y, cl = Math.cos(lean), sl = Math.sin(lean);
  const contactM = Math.sqrt((STRIDE.reachShare * (THIGH_M + SHIN_M)) ** 2 - s.halfM ** 2);
  const bobM = STRIDE.bobShare * s.halfM * (1 + Math.cos(4 * Math.PI * (share - s.duty / 2))) / 2;
  const rootY = contactM - bobM - dipM + ANKLE_Y - HIP_Y * cl;
  for (const [side, half] of [["L", 0], ["R", 0.5]] as const) {
    const x = restAt(`thigh.${side}`, body).x, foot = footOnStride(share + half, s);
    const twistedX = x * Math.cos(twist), twistedZ = -x * Math.sin(twist);
    const d = {
      x: x + way.x * foot.along - twistedX,
      y: ANKLE_Y + foot.lift - (rootY + HIP_Y * cl - twistedZ * sl),
      z: way.z * foot.along - twistedZ * cl,
    };
    const y = d.y * cl + d.z * sl, z = -d.y * sl + d.z * cl;
    const ct = Math.cos(twist), st = Math.sin(twist);
    const a = legAngles({ x: d.x * ct - z * st, y, z: d.x * st + z * ct }, THIGH_M, SHIN_M);
    joints[`thigh.${side}`] = { x: a.thighX, y: 0, z: a.thighZ };
    joints[`shin.${side}`] = { x: a.shinX, y: 0, z: 0 };
    joints[`foot.${side}`] = { x: STRIDE.toeRad * Math.sin(Math.PI * foot.swing), y: 0, z: 0 };
  }
  return rootY;
}

/** A slow breath standing: the chest rises (back, −x) and the neck keeps the head level. */
export const BREATH = { periodTime: 3.4, chestRad: 0.045, spineRad: 0.015, neckRad: 0.05, swayRad: 0.02 } as const;

export function breathOf(time: number): number {
  return Math.sin((2 * Math.PI * time) / BREATH.periodTime);
}

/** Hair hangs from the `hair` joint toward where gravity less the head's acceleration pulls it, on a spring. */
export const HAIR_SWAY = { stiffness: 140, damping: 11, share: 0.85, maxRad: 0.7, maxAccel: 40 } as const;
export interface Sway { x: number; z: number; vx: number; vz: number }
export const STILL_HAIR: Sway = { x: 0, z: 0, vx: 0, vz: 0 };
const GRAVITY = 9.8;

/** `down`: the world's down, `accel` (m/s²) the head's, both in the head's frame. */
export function swayHair(s: Sway, down: Vec3, accel: Vec3, dt: number): Sway {
  const a = Math.hypot(accel.x, accel.y, accel.z), k = a > HAIR_SWAY.maxAccel ? HAIR_SWAY.maxAccel / a : 1;
  const pull = {
    x: down.x * GRAVITY - accel.x * k, y: down.y * GRAVITY - accel.y * k, z: down.z * GRAVITY - accel.z * k,
  };
  const max = HAIR_SWAY.maxRad, share = HAIR_SWAY.share;
  const wantX = clamp(share * Math.atan2(-pull.z, -pull.y), -max, max);
  const wantZ = clamp(share * Math.atan2(pull.x, -pull.y), -max, max);
  const { stiffness, damping } = HAIR_SWAY;
  const vx = s.vx + (stiffness * (wantX - s.x) - damping * s.vx) * dt;
  const vz = s.vz + (stiffness * (wantZ - s.z) - damping * s.vz) * dt;
  return { x: clamp(s.x + vx * dt, -max, max), z: clamp(s.z + vz * dt, -max, max), vx, vz };
}
