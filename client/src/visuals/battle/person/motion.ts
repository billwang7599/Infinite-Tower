import { clamp, smoothstep, type Vec3 } from "@infinite-tower/shared";

/**
 * A full run's stride from the left foot's contact, in shares of it. The right leg and arm play the left's keys half a
 * stride later; `arm` in metres ahead.
 */
export const WALK = {
  at: [0, 0.25, 0.5, 0.75],
  /** Of each quarter, the share spent easing into its key; the rest holds it. */
  easeShare: 0.6,
  leg: { thigh: [-0.55, 0.05, 0.42, -0.4], shin: [0.1, 0.2, 0.3, 1.05], foot: [-0.1, 0, 0.3, 0] },
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
