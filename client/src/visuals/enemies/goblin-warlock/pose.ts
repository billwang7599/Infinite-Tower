import type { EnemyState, Vec3 } from "@infinite-tower/shared";

const OFF_HAND: Vec3 = { x: -0.2, y: 0.48, z: 0.1 };
const CHANT_HAND: Vec3 = { x: -0.16, y: 0.74, z: 0.3 };

// Own frame, +z ahead.
export interface GoblinPose {
  /** The staff's tilt forward from upright (rad): π/2 is level, pointing ahead. */
  staffPitch: number;
  handY: number;
  handZ: number;
  offHand: Vec3;
  lean: number;
  roll: number;
  rollRate: number;
  yOff: number;
  stars: boolean;
  glow: number;
}

export function goblinPose(state: EnemyState, t: number, wordsSaid: number): GoblinPose {
  const p: GoblinPose = {
    staffPitch: 0.25, handY: 0.62, handZ: 0.22, offHand: OFF_HAND, lean: 0, roll: 0, rollRate: state === "dead" ? 6 : 12, yOff: 0,
    stars: state === "stunned" || state === "staggered", glow: 0.15,
  };
  switch (state) {
    case "skillChant":
      Object.assign(p, {
        staffPitch: -0.1, handY: 0.82, offHand: CHANT_HAND, glow: Math.min(1, 0.35 + 0.2 * wordsSaid),
      });
      p.roll = Math.sin(t * 3) * 0.06;
      break;
    case "skillCast":
      Object.assign(p, { staffPitch: 1.1, handZ: 0.4, lean: 0.12, glow: 1 });
      break;
    case "lungeWindup":
      Object.assign(p, { staffPitch: 1.45, handZ: 0.02, lean: -0.12 });
      break;
    case "lunge":
      Object.assign(p, { staffPitch: Math.PI / 2, handZ: 0.5, lean: 0.18 });
      break;
    case "lungeRecover":
      Object.assign(p, { staffPitch: 0.9, handZ: 0.3, lean: 0.05 });
      break;
    case "stunned":
    case "staggered":
      p.staffPitch = 0.7;
      p.lean = -0.3;
      p.roll = Math.sin(t * (state === "staggered" ? 14 : 6)) * 0.18;
      break;
    case "dead":
      Object.assign(p, { staffPitch: 1.3, roll: Math.PI / 2, yOff: 0.2, glow: 0 });
      break;
  }
  return p;
}
