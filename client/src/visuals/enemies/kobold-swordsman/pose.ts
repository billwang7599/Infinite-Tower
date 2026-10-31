import type { EnemyState, Vec3 } from "@infinite-tower/shared";
import {
  DRAWBACK, drawnBack, pullOf, REELING_BLADE, type BladePose, type Cut, type WeaponMotion,
} from "../../battle/weapons.js";

const norm = ({ x, y, z }: Vec3): Vec3 => {
  const l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
};

/** The sword hand rides an arc this far (m) out along the blade from here, plus the blade pose's handZ. */
const HAND_PIVOT: Vec3 = { x: 0.2, y: 0.92, z: 0 };
const HAND_ARC_M = 0.28;
const OFF_HAND: Vec3 = { x: -0.32, y: 0.62, z: 0.2 };
/** The chest turns toward where the blade will be this much later (in the stroke's turns, or the wind-up's share). */
const LEAD_TURN = 0.2;
const LEAD_SET = 0.3;
/** The chest's turn (rad) with the blade straight out to a side; the hips lead twice as far ahead, a share as far. */
const TWIST_RAD = 0.6;
const HIP_SHARE = 0.4;
const BEND_RAD = 0.15;
/**
 * With the blade's draw-back (DRAWBACK), the body leans `leanRad` back, and the chest turns `turnRad` toward the
 * blade's side and bends `bendRad` toward its height.
 */
export const KOBOLD_DRAWBACK = { leanRad: 0.2, turnRad: 0.5, bendRad: 0.25 };

function coilToward(blade: Vec3): { x: number; y: number } {
  const flat = Math.hypot(blade.x, blade.y);
  return flat < 1e-6 ? { x: 0, y: 0 } : { x: blade.x / flat, y: blade.y / flat };
}

/** Where the kobold's parts head (the model eases toward them), in its own frame: +z ahead. */
export interface KoboldPose {
  blade: Vec3;
  /** The blade sweeps exactly, not eased (mid-swing). */
  bladeExact: boolean;
  hand: Vec3;
  offHand: Vec3;
  twist: number;
  hipTwist: number;
  /** The chest's lean forward (rad), on top of the whole body's. */
  bend: number;
  lean: number;
  roll: number;
  rollRate: number;
  yOff: number;
  stars: boolean;
}

export function koboldPose(
  state: EnemyState, t: number, k: number, cut: Cut, motion: WeaponMotion,
  stroke: { set: number; turn: number } | null, held: BladePose, heavy = false,
): KoboldPose {
  const tell = heavy ? DRAWBACK.heavyFactor : 1;
  const p = {
    ...held, bladeExact: false, lean: 0, roll: 0, rollRate: state === "dead" ? 6 : 12, yOff: 0,
    stars: state === "stunned",
  };
  const swinging = stroke !== null && (state === "weapon" || state === "weaponRecover" || state === "weaponWindup");
  if (swinging) {
    Object.assign(p, stroke.set < 1 ? motion.windup(cut, stroke.set, held) : motion.stroke(cut, stroke.turn));
    p.bladeExact = stroke.set >= 1;
  }
  switch (state) {
    case "weaponWindup":
      p.lean = -0.12 * k * tell;
      break;
    case "weapon":
      p.lean = stroke && stroke.turn < 1 / 3 ? -0.12 : 0.15;
      break;
    case "weaponRecover":
      p.lean = 0.08 * (1 - k);
      break;
    case "stunned":
    case "staggered":
      p.blade = REELING_BLADE;
      p.lean = -0.3;
      p.roll = Math.sin(t * (state === "staggered" ? 14 : 6)) * 0.18;
      break;
    case "dead":
      p.blade = norm({ x: 0.8, y: -0.4, z: 0 });
      p.roll = Math.PI / 2;
      p.yOff = 0.25;
      break;
  }
  const handBlade = p.blade, pull = swinging ? pullOf(stroke, heavy) : 0;
  p.blade = drawnBack(p.blade, pull);
  p.lean -= KOBOLD_DRAWBACK.leanRad * pull;
  const lead = (ahead: number): Vec3 => !swinging || !stroke ? p.blade : stroke.set < 1
    ? motion.windup(cut, Math.min(1, stroke.set + LEAD_SET * ahead), held).blade
    : motion.stroke(cut, stroke.turn + LEAD_TURN * ahead).blade;
  const dead = state === "dead", chestAt = lead(1), hipsAt = lead(2), coil = coilToward(chestAt);
  const coilTwist = KOBOLD_DRAWBACK.turnRad * pull * coil.x;
  return {
    ...p,
    hand: {
      x: HAND_PIVOT.x + handBlade.x * HAND_ARC_M, y: HAND_PIVOT.y + handBlade.y * HAND_ARC_M,
      z: HAND_PIVOT.z + p.handZ + handBlade.z * HAND_ARC_M,
    },
    offHand: OFF_HAND,
    twist: dead ? 0 : TWIST_RAD * chestAt.x + coilTwist,
    hipTwist: dead ? 0 : HIP_SHARE * (TWIST_RAD * hipsAt.x + coilTwist),
    bend: dead ? 0 : -BEND_RAD * chestAt.y - KOBOLD_DRAWBACK.bendRad * pull * coil.y,
  };
}
