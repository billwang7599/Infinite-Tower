import type { AttackKind, EnemyState, Vec3 } from "@infinite-tower/shared";
import type { WeaponMotion } from "../../battle/weapons.js";

const norm = ({ x, y, z }: Vec3): Vec3 => {
  const l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
};

/** Where the kobold's parts head (the model eases toward them), in its own frame: +z ahead. */
export interface KoboldPose {
  blade: Vec3;
  /** The blade sweeps exactly, not eased (mid-swing). */
  bladeExact: boolean;
  handZ: number;
  lean: number;
  roll: number;
  rollRate: number;
  yOff: number;
  stars: boolean;
  /** The wind-up's tell, 0 (none) to 1. */
  tell: number;
  /** The tell's arrow, turned this way in the kobold's frame (rad); null shows the stab's ring instead. */
  arrowRad: number | null;
}

/** `k`: the share of the state's duration gone; `stroke`: its swing's, while it has one (strokeOf). */
export function koboldPose(
  state: EnemyState, t: number, k: number, attack: AttackKind, motion: WeaponMotion,
  stroke: { set: number; turn: number } | null,
): KoboldPose {
  const p: KoboldPose = {
    ...motion.guard, bladeExact: false, lean: 0, roll: 0,
    rollRate: state === "dead" ? 6 : 12, yOff: 0, stars: state === "parried" || state === "stunned", tell: 0,
    arrowRad: null,
  };
  const swinging = stroke !== null && (state === "weaponWindup" || state === "weapon" || state === "weaponRecover");
  if (swinging) {
    // Set eases toward the swing's start; from the drive on, the blade is drawn exactly where the fight has it.
    Object.assign(p, stroke.set < 1 ? motion.windup(attack, stroke.set) : motion.stroke(attack, stroke.turn));
    p.bladeExact = stroke.set >= 1;
  }
  switch (state) {
    case "weaponWindup":
      p.lean = -0.12 * k;
      p.tell = 0.25 + 0.75 * k;
      p.arrowRad = motion.tellArrowRad(attack);
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
  return p;
}
