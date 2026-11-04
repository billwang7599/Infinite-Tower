import {
  FIXED_DT, PLAYER, smoothstep, type PlayerData, type SwingData, type Vec2, type Vec3, type WielderData,
} from "@infinite-tower/shared";
import { playerBlade } from "../pose.js";
import { pullOf, type BowLook, type WeaponMotion } from "../weapons.js";
import type { PersonBuild } from "./model.js";
import { restAt, type JointName } from "./skeleton.js";

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

export const POSED_JOINTS = [
  "root", "hips", "spine", "chest", "neck", "thigh.R", "thigh.L", "shin.R", "shin.L", "foot.R", "foot.L",
] as const satisfies readonly JointName[];
export type PosedJoint = (typeof POSED_JOINTS)[number];
type Axis = "x" | "y" | "z";
/** Per axis, a joint's rotation in its parent's frame (radians, Babylon's Euler): before the first key, then at each. */
export type Track = Partial<Record<Axis, readonly number[]>>;
export interface Clip { at: readonly number[]; joints: Partial<Record<PosedJoint, Track>> }

/** A thigh forward by c (−x) and its knee bent by 2c keeps the foot under the hip: a crouch. */
const crouch = (c: readonly number[]): Clip["joints"] => ({
  "thigh.R": { x: c.map((v) => -v) }, "thigh.L": { x: c.map((v) => -v) },
  "shin.R": { x: c.map((v) => 2 * v) }, "shin.L": { x: c.map((v) => 2 * v) },
});

/** Times in seconds unless a clip says otherwise. */
export const CLIPS = {
  /** For a dodge straight ahead: the root's lean is turned toward the way it goes. */
  dodge: {
    at: [0, 0.6 * PLAYER.dodge.duration],
    joints: {
      ...crouch([0, 0.75, 0.2]), root: { x: [0, 0.85, 0.15] }, spine: { x: [0, 0.3, 0.05] },
      "thigh.R": { x: [0, -0.75, -0.2], z: [0, 0.3, 0.04] }, "thigh.L": { x: [0, -0.75, -0.2], z: [0, -0.3, -0.04] },
    },
  },
  /** Times are shares of the stagger; the roll is toward the sword hand's side. */
  stagger: { at: [0, 0.5], joints: { root: { x: [0, -0.35, -0.15], z: [0, 0.08, -0.12] }, neck: { x: [0, -0.3, 0] } } },
  block: { at: [0], joints: { ...crouch([0, 0.25]), root: { x: [-0.05, -0.05] } } },
  defeat: { at: [0, 0.3], joints: { ...crouch([0, 1.1, 1.1]), root: { x: [0, 0.35, 0.1], z: [0, 0, Math.PI / 2] } } },
  swing: { at: [], joints: crouch([0.15]) },
  airborne: { at: [], joints: crouch([0.6]) },
} as const satisfies Record<string, Clip>;

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
/** How the body's turn toward the blade is shared out, hips to chest; the neck turns back by its own share. */
const TWIST_SHARES = { hips: 0.4, spine: 0.3, chest: 0.3, neck: -0.6 } as const;
const BEND_RAD = 0.15;
const PULL_LEAN_RAD = 0.2;
const STRIKE_LEAN_RAD = 0.15;
const KNEE_LIFT = 0.6;
const BOW_UPRIGHT = { x: 0.12, y: 0.99, z: 0 };
/** How far the body turns side-on drawing, hips to chest; the neck turns back to look down the arrow. */
const DRAW_TWIST = { hips: -0.25, spine: -0.25, chest: -0.3, neck: 0.7 } as const;
const LOOSED_FLICK_M = 0.06;
const BOW_CARRY = { outM: 0.05, drop: 0.9, aheadM: 0.08 } as const;
const THIGH_M = -restAt("shin.R", "medium").y, SHIN_M = -restAt("foot.R", "medium").y;

/** In the model's frame, feet at 0 and +z ahead. */
export interface PersonPose {
  blade: Vec3;
  bladeExact: boolean;
  hand: Vec3;
  offHand: Vec3;
  joints: Record<PosedJoint, Vec3>;
  /** The root's height (m), down as the knees bend so the feet stay on the ground. */
  rootY: number;
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
  /** A bow in hand: how far it's drawn, 0..1. */
  bow?: BowLook & { drawn: number };
}

type Doing = Pick<PlayerData, "action" | "actionTime" | "way" | "grounded">;

function play(joints: PersonPose["joints"], clip: Clip, t: number, scale: Partial<Record<PosedJoint, Vec3>> = {}): void {
  for (const [name, track] of Object.entries(clip.joints) as [PosedJoint, Track][]) {
    for (const axis of ["x", "y", "z"] as const) {
      const values = track[axis];
      if (values) joints[name][axis] += keyed(t, clip.at, values) * (scale[name]?.[axis] ?? 1);
    }
  }
}

export function personPose(
  player: Doing, wielder: Pick<WielderData, "swing">, motion: WeaponMotion, o: PersonMoment,
): PersonPose {
  const { build: b, side, alive } = o, { swing } = wielder, t = player.actionTime;
  const { blade, exact, handZ } = playerBlade(player, wielder, alive, motion, 1, keyedStroke);
  const reach = b.reachM, scale = reach / MOTION_ARM_M;
  const pivot = { x: side * b.shoulderM * PIVOT_OUT, y: b.shoulderY - reach * PIVOT_DROP, z: 0 };
  const arc = reach * HAND_ARC;
  const restOff: Vec3 = { x: -side * (b.shoulderM + 0.03), y: b.shoulderY - reach * 0.95, z: 0.05 };
  const joints = Object.fromEntries(POSED_JOINTS.map((j) => [j, { x: 0, y: 0, z: 0 }])) as PersonPose["joints"];
  const p: PersonPose = {
    blade, bladeExact: exact,
    hand: { x: pivot.x + blade.x * arc, y: pivot.y + blade.y * arc, z: handZ * scale + blade.z * arc },
    offHand: restOff, joints, rootY: 0,
  };
  if (alive) {
    const twist = TWIST_RAD * blade.x, bend = -BEND_RAD * blade.y;
    for (const [j, share] of Object.entries(TWIST_SHARES)) joints[j as PosedJoint].y = share * twist;
    joints.spine.x = joints.chest.x = bend / 2;
  }
  const towardOff = (to: Vec3) => {
    const k = keyed(t, [0], [0, 1]);
    p.offHand = { x: restOff.x + (to.x - restOff.x) * k, y: restOff.y + (to.y - restOff.y) * k,
      z: restOff.z + (to.z - restOff.z) * k };
  };

  if (!alive) {
    play(joints, CLIPS.defeat, o.deadTime);
  } else if (swing && swing.step < swing.endAt) {
    const stroke = keyedStroke(swing), pull = pullOf(stroke, swing.attack === "heavy");
    joints.root.x = stroke.turn < 1 / 3 ? -PULL_LEAN_RAD * pull : STRIKE_LEAN_RAD;
    play(joints, CLIPS.swing, 0);
  } else {
    switch (player.action) {
      case "dodge": {
        const clip = CLIPS.dodge;
        play(joints, clip, t, { root: { x: o.dodge.z, y: 1, z: 1 } });
        joints.root.z -= keyed(t, clip.at, clip.joints.root.x) * o.dodge.x;
        break;
      }
      case "stagger": {
        const { at, joints: keys } = CLIPS.stagger, { left, of } = o.stagger;
        play(joints, { at: at.map((share) => share * of), joints: keys }, of - left, { root: { x: 1, y: 1, z: side } });
        break;
      }
      case "block":
        play(joints, CLIPS.block, t);
        break;
      case "chant":
        towardOff({ x: -side * 0.08, y: b.shoulderY - 0.05, z: reach * 0.85 });
        break;
      case "cast":
      case "beam":
        towardOff({ x: -side * 0.04, y: b.shoulderY, z: reach });
        joints.root.x = 0.08;
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
      case "none":
        if (o.bow) {
          p.hand = {
            x: side * (b.shoulderM + BOW_CARRY.outM), y: b.shoulderY - reach * BOW_CARRY.drop, z: BOW_CARRY.aheadM,
          };
        }
        break;
      case "draw":
      case "loose":
        if (o.bow) drawPose(p, o.bow, b, side, player.action === "loose");
        break;
    }
  }
  if (alive && !player.grounded) play(joints, CLIPS.airborne, 0);
  if (alive && player.grounded && o.walk.amp > 0 && player.action === "none") {
    const stride = o.walk.amp * Math.sin(keyedPhase(o.walk.phase));
    joints["thigh.L"].x += stride;
    joints["thigh.R"].x -= stride;
    joints["shin.L"].x += Math.max(0, -stride) * KNEE_LIFT;
    joints["shin.R"].x += Math.max(0, stride) * KNEE_LIFT;
    p.offHand = { ...p.offHand, z: p.offHand.z - stride * 0.3 };
  }
  for (const s of ["R", "L"] as const) joints[`foot.${s}`].x = -(joints[`thigh.${s}`].x + joints[`shin.${s}`].x);
  const thigh = joints["thigh.R"].x, knee = thigh + joints["shin.R"].x;
  p.rootY = -(THIGH_M * (1 - Math.cos(thigh)) + SHIN_M * (1 - Math.cos(knee)))
    + (alive ? 0 : Math.abs(Math.sin(joints.root.z)) * b.shoulderM);
  return p;
}

function drawPose(p: PersonPose, bow: BowLook & { drawn: number }, b: PersonBuild, side: 1 | -1, loosed: boolean): void {
  const y = b.shoulderY + 0.04, z = b.reachM + 0.05;
  p.blade = { ...BOW_UPRIGHT, x: side * BOW_UPRIGHT.x };
  p.bladeExact = false;
  p.hand = { x: side * 0.02, y, z };
  const back = bow.braceM + bow.drawM * (loosed ? 1 : bow.drawn);
  p.offHand = { x: p.hand.x - (loosed ? side * LOOSED_FLICK_M : 0), y, z: z - back };
  for (const [j, turn] of Object.entries(DRAW_TWIST)) p.joints[j as PosedJoint].y = side * turn;
  p.joints.spine.x = p.joints.chest.x = 0;
}
