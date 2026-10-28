import { isSwing, type AttackKind, type EnemyState, type Vec3 } from "@infinite-tower/shared";
import { SCREEN_DIR } from "../../pose.js";

const norm = ({ x, y, z }: Vec3): Vec3 => {
  const l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
};
/** The blade on guard: up and forward, toward whoever it faces. */
const GUARD_DIR = norm({ x: 0.25, y: 0.7, z: 0.65 });
/** The blade as it ends a stab, and drawn back before one. */
const STAB_DIR = norm({ x: 0, y: 0.08, z: 1 });
/** How far forward (m) a wound-up blade leans, on either side of its swing. */
const WINDUP_LEAN = 0.35;
const GUARD_HAND_Z = 0.28;

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

/**
 * Where a swing starts, in the kobold's own frame: the far end of its line from where it's going. Its way across the
 * screen is as the player facing the kobold sees it, so the kobold's x is the screen's, mirrored.
 */
function swingStart(attack: AttackKind): Vec3 {
  if (!isSwing(attack)) return STAB_DIR;
  const { x, y } = SCREEN_DIR[attack];
  return { x, y: -y, z: 0 };
}

/** `k`: the share of the state's duration gone; `active`: the swing's live time (s). */
export function koboldPose(state: EnemyState, t: number, k: number, attack: AttackKind, active: number): KoboldPose {
  const p: KoboldPose = {
    blade: GUARD_DIR, bladeExact: state === "sword", handZ: GUARD_HAND_Z, lean: 0, roll: 0,
    rollRate: state === "dead" ? 6 : 12, yOff: 0, stars: state === "parried" || state === "stunned", tell: 0,
    arrowRad: null,
  };
  switch (state) {
    case "swordWindup": {
      const start = swingStart(attack), to = isSwing(attack) ? { x: start.x, y: start.y, z: WINDUP_LEAN } : STAB_DIR;
      p.blade = norm({
        x: GUARD_DIR.x + (to.x - GUARD_DIR.x) * k, y: GUARD_DIR.y + (to.y - GUARD_DIR.y) * k,
        z: GUARD_DIR.z + (to.z - GUARD_DIR.z) * k,
      });
      if (!isSwing(attack)) p.handZ = GUARD_HAND_Z - 0.3 * k;
      p.lean = -0.12 * k;
      p.tell = 0.25 + 0.75 * k;
      break;
    }
    case "sword": {
      const s = Math.min(1, t / Math.max(0.01, active));
      if (isSwing(attack)) {
        // From the start, through straight ahead, to the line's other end.
        const start = swingStart(attack), a = Math.PI * s;
        p.blade = norm({ x: start.x * Math.cos(a), y: start.y * Math.cos(a), z: Math.sin(a) + 0.15 });
      } else {
        p.blade = STAB_DIR;
        p.handZ = GUARD_HAND_Z + 0.45 * Math.sin(Math.PI * s);
      }
      p.lean = 0.15;
      break;
    }
    case "swordRecover":
      p.blade = norm({ x: 0.3, y: -0.6, z: 0.5 });
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
  if (p.tell > 0 && isSwing(attack)) {
    const { x, y } = SCREEN_DIR[attack];
    // Its +y along (-x, y) in the kobold's frame: the screen's x is mirrored, seen from in front.
    p.arrowRad = Math.atan2(x, y);
  }
  return p;
}
