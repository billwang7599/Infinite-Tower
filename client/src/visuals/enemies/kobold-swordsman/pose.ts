import type { AttackKind, EnemyState, Vec3 } from "@infinite-tower/shared";
import type { WeaponMotion } from "../../battle/weapons.js";

const norm = ({ x, y, z }: Vec3): Vec3 => {
  const l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
};

/** The sword hand rides an arc this far (m) out along the blade from here, plus the blade pose's handZ. */
const HAND_PIVOT: Vec3 = { x: 0.2, y: 0.92, z: 0 };
const HAND_ARC_M = 0.28;
const OFF_HAND: Vec3 = { x: -0.3, y: 0.8, z: 0.16 };
/** The chest turns toward where the blade will be this much later (in the stroke's turns, or the wind-up's share). */
const LEAD_TURN = 0.2;
const LEAD_SET = 0.3;
/** The chest's turn (rad) with the blade straight out to a side; the hips lead twice as far ahead, a share as far. */
const TWIST_RAD = 0.6;
const HIP_SHARE = 0.4;
const BEND_RAD = 0.15;

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

/** `k`: the share of the state's duration gone; `stroke`: its swing's, while it has one (strokeOf). */
export function koboldPose(
  state: EnemyState, t: number, k: number, attack: AttackKind, motion: WeaponMotion,
  stroke: { set: number; turn: number } | null,
): KoboldPose {
  const p = {
    ...motion.guard, bladeExact: false, lean: 0, roll: 0,
    rollRate: state === "dead" ? 6 : 12, yOff: 0, stars: state === "parried" || state === "stunned",
  };
  const swinging = stroke !== null && (state === "weaponWindup" || state === "weapon" || state === "weaponRecover");
  if (swinging) {
    Object.assign(p, stroke.set < 1 ? motion.windup(attack, stroke.set) : motion.stroke(attack, stroke.turn));
    p.bladeExact = stroke.set >= 1;
  }
  switch (state) {
    case "weaponWindup":
      p.lean = -0.12 * k;
      break;
    case "weapon":
      p.lean = 0.15;
      break;
    case "weaponRecover":
      if (!swinging) p.blade = norm({ x: 0.3, y: -0.6, z: 0.5 });
      p.lean = 0.08 * (1 - k);
      break;
    case "parried":
    case "stunned":
    case "staggered":
      p.blade = norm({ x: 0.6, y: -0.5, z: -0.2 });
      p.lean = -0.3;
      p.roll = Math.sin(t * (state === "staggered" ? 14 : 6)) * 0.18;
      break;
    case "dead":
      p.blade = norm({ x: 0.8, y: -0.4, z: 0 });
      p.roll = Math.PI / 2;
      p.yOff = 0.25;
      break;
  }
  const lead = (ahead: number): Vec3 => !swinging || !stroke ? p.blade : stroke.set < 1
    ? motion.windup(attack, Math.min(1, stroke.set + LEAD_SET * ahead)).blade
    : motion.stroke(attack, stroke.turn + LEAD_TURN * ahead).blade;
  const dead = state === "dead", chestAt = lead(1), hipsAt = lead(2);
  return {
    ...p,
    hand: {
      x: HAND_PIVOT.x + p.blade.x * HAND_ARC_M, y: HAND_PIVOT.y + p.blade.y * HAND_ARC_M,
      z: HAND_PIVOT.z + p.handZ + p.blade.z * HAND_ARC_M,
    },
    offHand: OFF_HAND,
    twist: dead ? 0 : TWIST_RAD * chestAt.x,
    hipTwist: dead ? 0 : TWIST_RAD * HIP_SHARE * hipsAt.x,
    bend: dead ? 0 : -BEND_RAD * chestAt.y,
  };
}
