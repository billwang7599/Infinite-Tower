import {
  FIXED_DT, PLAYER, smoothstep, type PlayerData, type SwingData, type Vec2, type Vec3, type WielderData,
} from "@infinite-tower/shared";
import { playerBlade } from "../pose.js";
import { pullOf, type BowLook, type WeaponMotion } from "../weapons.js";
import type { PersonBuild } from "./model.js";
import { BREATH, breathOf, WALK, walkKey } from "./motion.js";
import { restAt, type JointName } from "./skeleton.js";

/** Pose to pose, as Dead Cells animates: each key is eased into this fast, then held until the next. */
export const KEY_EASE_TIME = 0.07;

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

/** Times in seconds unless a clip says otherwise; written for the right hand, mirrored for the left. */
export const CLIPS = {
  idle: {
    at: [], joints: {
      "thigh.R": { x: [-0.05], z: [0.07] }, "thigh.L": { x: [-0.12], z: [-0.07] },
      "shin.R": { x: [0.1] }, "shin.L": { x: [0.3] }, hips: { z: [0.025] }, spine: { z: [-0.02] },
    },
  },
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
  /** Keyed at the swing's own steps: its start, the drive, going live, the follow-through. */
  swing: {
    at: [0, 1, 2, 3],
    joints: {
      "thigh.L": { x: [0, -0.35, -0.32, -0.6, -0.55] }, "shin.L": { x: [0, 0.7, 0.66, 0.62, 0.58] },
      "thigh.R": { x: [0, 0.15, 0.14, 0.42, 0.4] }, "shin.R": { x: [0, 0.35, 0.33, 0.08, 0.08] },
      root: { x: [0, -0.1, -0.05, 0.22, 0.17] }, neck: { x: [0, 0.06, 0.02, -0.12, -0.09] },
    },
  },
  draw: {
    at: [0],
    joints: {
      "thigh.R": { x: [0, -0.12], z: [0, 0.16] }, "thigh.L": { x: [0, 0.1], z: [0, -0.16] },
      "shin.R": { x: [0, 0.22] }, "shin.L": { x: [0, 0.12] }, root: { x: [0, -0.05] }, chest: { x: [0, -0.06] },
    },
  },
  loose: { at: [0, 0.12], joints: { root: { x: [-0.05, -0.12, -0.04] }, neck: { x: [0, 0.08, 0] } } },
  airborne: { at: [], joints: crouch([0.6]) },
} as const satisfies Record<string, Clip>;

function keyedStroke({ step, driveAt, liveAt, liveUntil }: SwingData): { set: number; turn: number } {
  const ease = KEY_EASE_TIME / FIXED_DT;
  return {
    set: keyed(step, [0], [0, 1], ease),
    turn: keyed(step, [driveAt, liveAt, liveUntil], [0, 1 / 3, 2 / 3, 1], ease),
  };
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
/** The sword hand's share of the walk's arm swing. */
const SWORD_ARM_SWING = 0.35;
const BOW_UPRIGHT = { x: 0.12, y: 0.99, z: 0 };
/** How far the body turns side-on drawing, hips to chest; the neck turns back to look down the arrow. */
const DRAW_TWIST = { hips: -0.25, spine: -0.25, chest: -0.3, neck: 0.7 } as const;
const LOOSED_FLICK_M = 0.06;
const BOW_CARRY = { outM: 0.05, drop: 0.9, aheadM: 0.08 } as const;
const THIGH_M = -restAt("shin.R", "medium").y, SHIN_M = -restAt("foot.R", "medium").y;

/** How far (m) a leg's foot rises toward its hip from hanging straight. */
export function legDrop(thigh: Vec3, shin: Vec3): number {
  return THIGH_M + SHIN_M - Math.cos(thigh.z) * (THIGH_M * Math.cos(thigh.x) + SHIN_M * Math.cos(thigh.x + shin.x));
}

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
  /** Seconds, for breathing. */
  time: number;
  /** `phase` in radians, 2π a stride; `amp` 0..1 of a full run's stride. */
  walk: { phase: number; amp: number };
  /** A bow in hand: how far it's drawn, 0..1. */
  bow?: BowLook & { drawn: number };
}

type Doing = Pick<PlayerData, "action" | "actionTime" | "way" | "grounded">;

const MIRRORED = Object.fromEntries(POSED_JOINTS.map((j) => [j, j.replace(/\.R$/, ".X").replace(/\.L$/, ".R")
  .replace(/\.X$/, ".L")])) as Record<PosedJoint, PosedJoint>;

interface Playing { scale?: Partial<Record<PosedJoint, Vec3>>; side?: 1 | -1; weight?: number }

function play(
  joints: PersonPose["joints"], clip: Clip, t: number, { scale = {}, side = 1, weight = 1 }: Playing = {},
): void {
  for (const [name, track] of Object.entries(clip.joints) as [PosedJoint, Track][]) {
    const to = side === 1 ? name : MIRRORED[name];
    for (const axis of ["x", "y", "z"] as const) {
      const values = track[axis], flip = side === -1 && axis !== "x" ? -1 : 1;
      if (values) joints[to][axis] += keyed(t, clip.at, values) * (scale[name]?.[axis] ?? 1) * flip * weight;
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

  const walking = alive && player.grounded && o.walk.amp > 0 && player.action === "none";
  if (!alive) {
    play(joints, CLIPS.defeat, o.deadTime);
  } else if (swing && swing.step < swing.endAt) {
    const stroke = keyedStroke(swing), pull = pullOf(stroke, swing.attack === "heavy");
    if (stroke.turn < 1 / 3) joints.root.x -= PULL_LEAN_RAD * pull;
    const keys = [0, swing.driveAt, swing.liveAt, swing.liveUntil].map((step) => step * FIXED_DT);
    play(joints, { at: keys, joints: CLIPS.swing.joints }, swing.step * FIXED_DT, { side });
  } else {
    switch (player.action) {
      case "dodge": {
        const clip = CLIPS.dodge;
        play(joints, clip, t, { scale: { root: { x: o.dodge.z, y: 1, z: 1 } } });
        joints.root.z -= keyed(t, clip.at, clip.joints.root.x) * o.dodge.x;
        break;
      }
      case "stagger": {
        const { at, joints: keys } = CLIPS.stagger, { left, of } = o.stagger;
        play(joints, { at: at.map((share) => share * of), joints: keys }, of - left,
          { scale: { root: { x: 1, y: 1, z: side } } });
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
        play(joints, CLIPS.idle, 0, { side, weight: walking ? 1 - o.walk.amp : 1 });
        if (o.bow) {
          p.hand = {
            x: side * (b.shoulderM + BOW_CARRY.outM), y: b.shoulderY - reach * BOW_CARRY.drop, z: BOW_CARRY.aheadM,
          };
        }
        break;
      case "draw":
      case "loose":
        if (o.bow) {
          drawPose(p, o.bow, b, side, player.action === "loose");
          play(joints, CLIPS.draw, player.action === "draw" ? t : 1, { side });
          if (player.action === "loose") play(joints, CLIPS.loose, t);
        }
        break;
    }
  }
  if (alive && !player.grounded) play(joints, CLIPS.airborne, 0);
  if (walking) walk(p, o.walk, reach, side);
  if (alive && !walking) {
    const breath = breathOf(o.time);
    joints.chest.x -= BREATH.chestRad * breath;
    joints.spine.x -= BREATH.spineRad * breath;
    joints.neck.x += BREATH.neckRad * breath;
    joints.hips.z += BREATH.swayRad * breathOf(o.time / 2);
  }
  for (const s of ["R", "L"] as const) joints[`foot.${s}`].x -= joints[`thigh.${s}`].x + joints[`shin.${s}`].x;
  p.rootY = -Math.min(legDrop(joints["thigh.R"], joints["shin.R"]), legDrop(joints["thigh.L"], joints["shin.L"]))
    + (alive ? 0 : Math.abs(Math.sin(joints.root.z)) * b.shoulderM);
  return p;
}

function walk(p: PersonPose, { phase, amp }: PersonMoment["walk"], reach: number, side: 1 | -1): void {
  const { joints } = p, share = phase / (2 * Math.PI), at = (keys: readonly number[], half = 0) =>
    amp * walkKey(share + half, keys);
  for (const [s, half] of [["L", 0], ["R", 0.5]] as const) {
    joints[`thigh.${s}`].x += at(WALK.leg.thigh, half);
    joints[`shin.${s}`].x += at(WALK.leg.shin, half);
    joints[`foot.${s}`].x += at(WALK.leg.foot, half);
  }
  joints.hips.y += at(WALK.hips);
  joints.chest.y += at(WALK.chest);
  joints.neck.y += at(WALK.neck);
  joints.root.x += amp * WALK.leanRad;
  const scale = reach / MOTION_ARM_M;
  const offHalf = side === 1 ? 0 : 0.5;
  p.offHand = { ...p.offHand, z: p.offHand.z + at(WALK.arm, offHalf) * scale };
  p.hand = { ...p.hand, z: p.hand.z + at(WALK.arm, 0.5 - offHalf) * scale * SWORD_ARM_SWING };
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
