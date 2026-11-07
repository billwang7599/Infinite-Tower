import {
  FIXED_DT, PLAYER, smoothstep, type PlayerData, type SwingData, type Vec2, type Vec3, type WielderData,
} from "@infinite-tower/shared";
import { playerBlade } from "../pose.js";
import { pullOf, type WeaponMotion } from "../weapons.js";
import type { PersonBuild } from "./model.js";

/** Pose to pose, as Dead Cells animates: each key is eased into this fast, then held until the next. */
export const KEY_EASE_TIME = 0.07;
export const WALK_KEYS = 4;
const WALK_EASE_SHARE = 0.35;

/** `values` has one more than `at`: the pose before the first key, then each key's. */
export function keyed(t: number, at: readonly number[], values: readonly number[], easeTime = KEY_EASE_TIME): number {
  let i = -1;
  while (i + 1 < at.length && at[i + 1]! <= t) i++;
  if (i < 0) return values[0]!;
  const span = Math.min(easeTime, (at[i + 1] ?? Infinity) - at[i]!);
  return values[i]! + (values[i + 1]! - values[i]!) * smoothstep(0, span, t - at[i]!);
}

function keyedStroke({ step, driveAt, liveAt, liveUntil }: SwingData): { set: number; turn: number } {
  const ease = KEY_EASE_TIME / FIXED_DT;
  return {
    set: keyed(step, [0], [0, 1], ease),
    turn: keyed(step, [driveAt, liveAt, liveUntil], [0, 1 / 3, 2 / 3, 1], ease),
  };
}

function keyedPhase(phase: number): number {
  const q = (2 * Math.PI) / WALK_KEYS, base = Math.floor(phase / q) * q;
  return base + q * smoothstep(0, WALK_EASE_SHARE, (phase - base) / q);
}

/** The motions are sized for this arm (the kobold's). */
const MOTION_ARM_M = PLAYER.armReachM;
const PIVOT_OUT = 0.55;
const PIVOT_DROP = 0.3;
const HAND_ARC = 0.35;
const TWIST_RAD = 0.6;
const HIP_SHARE = 0.4;
const BEND_RAD = 0.15;
const PULL_LEAN_RAD = 0.2;
const STRIKE_LEAN_RAD = 0.15;
const DODGE_RECOVER = 0.6;

/** In the model's frame, feet at 0 and +z ahead; angles in radians. */
export interface PersonPose {
  blade: Vec3;
  bladeExact: boolean;
  hand: Vec3;
  offHand: Vec3;
  twist: number;
  hipTwist: number;
  bend: number;
  lean: number;
  roll: number;
  /** How far the thighs come forward; the knees bend twice that. */
  crouch: number;
  legSwing: number;
  yOff: number;
}

export interface PersonMoment {
  build: PersonBuild;
  /** 1: the blade in the right hand. */
  side: 1 | -1;
  alive: boolean;
  /** In the model's frame. */
  dodge: Vec2;
  stagger: { left: number; of: number };
  deadTime: number;
  walk: { phase: number; amp: number };
}

type Doing = Pick<PlayerData, "action" | "actionTime" | "way" | "grounded">;

export function personPose(
  player: Doing, wielder: Pick<WielderData, "swing">, motion: WeaponMotion, o: PersonMoment,
): PersonPose {
  const { build: b, side, alive } = o, { swing } = wielder, t = player.actionTime;
  const { blade, exact, handZ } = playerBlade(player, wielder, alive, motion, 1, keyedStroke);
  const reach = b.reachM, scale = reach / MOTION_ARM_M;
  const pivot = { x: side * b.shoulderM * PIVOT_OUT, y: b.shoulderY - reach * PIVOT_DROP, z: 0 };
  const arc = reach * HAND_ARC;
  const restOff: Vec3 = { x: -side * (b.shoulderM + 0.03), y: b.shoulderY - reach * 0.95, z: 0.05 };
  const p: PersonPose = {
    blade, bladeExact: exact,
    hand: { x: pivot.x + blade.x * arc, y: pivot.y + blade.y * arc, z: handZ * scale + blade.z * arc },
    offHand: restOff,
    twist: alive ? TWIST_RAD * blade.x : 0, hipTwist: 0, bend: alive ? -BEND_RAD * blade.y : 0,
    lean: 0, roll: 0, crouch: 0, legSwing: 0, yOff: 0,
  };
  p.hipTwist = HIP_SHARE * p.twist;
  const towardOff = (to: Vec3) => {
    const k = keyed(t, [0], [0, 1]);
    p.offHand = { x: restOff.x + (to.x - restOff.x) * k, y: restOff.y + (to.y - restOff.y) * k,
      z: restOff.z + (to.z - restOff.z) * k };
  };

  if (!alive) {
    const at = [0, 0.3];
    p.crouch = keyed(o.deadTime, at, [0, 1.1, 1.1]);
    p.lean = keyed(o.deadTime, at, [0, 0.35, 0.1]);
    p.roll = keyed(o.deadTime, at, [0, 0, Math.PI / 2]);
  } else if (swing && swing.step < swing.endAt) {
    const stroke = keyedStroke(swing), pull = pullOf(stroke, swing.attack === "heavy");
    p.lean = stroke.turn < 1 / 3 ? -PULL_LEAN_RAD * pull : STRIKE_LEAN_RAD;
    p.crouch = 0.15;
  } else {
    switch (player.action) {
      case "dodge": {
        const at = [0, DODGE_RECOVER * PLAYER.dodge.duration], lean = keyed(t, at, [0, 0.5, 0.1]);
        p.crouch = keyed(t, at, [0, 0.7, 0.2]);
        p.lean = lean * o.dodge.z;
        p.roll = -lean * o.dodge.x;
        break;
      }
      case "stagger": {
        const at = [0, o.stagger.of / 2], since = o.stagger.of - o.stagger.left;
        p.lean = keyed(since, at, [0, -0.35, -0.15]);
        p.roll = side * keyed(since, at, [0, 0.08, -0.12]);
        break;
      }
      case "block":
        p.crouch = keyed(t, [0], [0, 0.25]);
        p.lean = -0.05;
        break;
      case "chant":
        towardOff({ x: -side * 0.08, y: b.shoulderY - 0.05, z: reach * 0.85 });
        break;
      case "cast":
      case "beam":
        towardOff({ x: -side * 0.04, y: b.shoulderY, z: reach });
        p.lean = 0.08;
        break;
      case "write":
        towardOff({ x: -side * 0.06, y: b.shoulderY - reach * 0.5, z: reach * 0.6 });
        break;
      case "use":
        towardOff({ x: -side * 0.04, y: b.headY - b.headM * 0.4, z: b.headM * 0.9 });
        break;
      case "bag":
        towardOff({ x: -side * 0.1, y: b.waistY, z: reach * 0.5 });
        break;
    }
  }
  if (alive && !player.grounded) p.crouch = 0.6;
  if (alive && player.grounded && o.walk.amp > 0 && player.action === "none") {
    p.legSwing = o.walk.amp * Math.sin(keyedPhase(o.walk.phase));
    p.offHand = { ...p.offHand, z: p.offHand.z - p.legSwing * 0.3 };
  }
  p.yOff = -b.legY * (1 - Math.cos(p.crouch)) + Math.sin(p.roll) * b.shoulderM;
  return p;
}
