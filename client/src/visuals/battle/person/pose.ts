import {
  clamp, FIXED_DT, PLAYER, smoothstep, type GuardKind, type PlayerData, type SwingData, type SwingDir, type Vec2,
  type Vec3, type WielderData,
} from "@infinite-tower/shared";
import { carryPose, guardPose } from "../guard.js";
import { playerBlade, STAGGERED } from "../pose.js";
import { DRAWBACK, wayCut, type BladePose, type BowLook, type WeaponMotion } from "../weapons.js";
import type { PersonBuild } from "./model.js";
import { BREATH, breathOf, plantLegs, strideOf, WALK, walkKey } from "./motion.js";
import { restAt, type JointName } from "./skeleton.js";

export const KEY_EASE_TIME = 0.07;
const CREEP_SHARE = 0.25;

const eased = (t: number, span: number, fastTime = KEY_EASE_TIME): number =>
  (1 - CREEP_SHARE) * smoothstep(0, Math.min(fastTime, span), t) + CREEP_SHARE * clamp(t / span, 0, 1);

export function keyed(t: number, at: readonly number[], values: readonly number[], end?: number): number {
  let i = -1;
  while (i + 1 < at.length && at[i + 1]! <= t) i++;
  if (i < 0) return values[0]!;
  const span = Math.max(1e-9, (at[i + 1] ?? end ?? at[i]! + KEY_EASE_TIME) - at[i]!);
  return values[i]! + (values[i + 1]! - values[i]!) * eased(t - at[i]!, span);
}

export const POSED_JOINTS = [
  "root", "hips", "spine", "chest", "neck", "thigh.R", "thigh.L", "shin.R", "shin.L", "foot.R", "foot.L",
] as const satisfies readonly JointName[];
export type PosedJoint = (typeof POSED_JOINTS)[number];
type Axis = "x" | "y" | "z";
/** Per axis, a joint's rotation in its parent's frame (radians, Babylon's Euler): before the first key, then at each. */
export type Track = Partial<Record<Axis, readonly number[]>>;
export interface Clip { at: readonly number[]; end?: number; joints: Partial<Record<PosedJoint, Track>> }

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
    at: [0, 0.6 * PLAYER.dodge.duration], end: PLAYER.dodge.duration,
    joints: {
      ...crouch([0, 0.75, 0.2]), root: { x: [0, 0.85, 0.15] }, spine: { x: [0, 0.3, 0.05] },
      "thigh.R": { x: [0, -0.75, -0.2], z: [0, 0.3, 0.04] }, "thigh.L": { x: [0, -0.75, -0.2], z: [0, -0.3, -0.04] },
    },
  },
  /** Times are shares of the stagger; the roll is toward the sword hand's side. */
  stagger: {
    at: [0, 0.5], end: 1, joints: { root: { x: [0, -0.35, -0.15], z: [0, 0.08, -0.12] }, neck: { x: [0, -0.3, 0] } },
  },
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

export const drawnStep = (swing: SwingData, alpha: number): number => Math.max(0, swing.step - 1 + alpha);

export const SWING_ARC = {
  backRad: DRAWBACK.swingRad, overRad: 0.35, heavyOverRad: 0.8, hitSpeed: 2.5, windupTime: 0.1,
} as const;

const hermite = (u: number, p0: number, m0: number, p1: number, m1: number): number => {
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (3 * u2 - 2 * u3) * p1 + (u3 - u2) * m1;
};

export function swingArc(
  swing: SwingData, alpha: number, backRad: number, overRad: number,
): { set: number; arcRad: number } {
  const { liveAt, endAt } = swing, driveAt = Math.max(1, swing.driveAt), s = Math.min(drawnStep(swing, alpha), endAt);
  const windupTime = SWING_ARC.windupTime, set = smoothstep(0, Math.min(windupTime / FIXED_DT, driveAt), s);
  if (s < driveAt) return { set, arcRad: -backRad * eased(s * FIXED_DT, driveAt * FIXED_DT, windupTime) };
  const creepPerStep = (CREEP_SHARE * backRad) / driveAt, ahead = Math.PI / 2;
  const driveSteps = Math.max(1, liveAt - driveAt), followSteps = Math.max(1, endAt - liveAt);
  // As fast into the hit as the drive allows, no faster than the follow-through can slow from without turning back.
  const hitPerStep = Math.min((SWING_ARC.hitSpeed * (ahead + backRad)) / driveSteps,
    (3 * (ahead + overRad)) / followSteps);
  if (s < liveAt) {
    const u = (s - driveAt) / driveSteps;
    return { set, arcRad: hermite(u, -backRad, -creepPerStep * driveSteps, ahead, hitPerStep * driveSteps) };
  }
  const u = (s - liveAt) / followSteps;
  return { set, arcRad: hermite(u, ahead, hitPerStep * followSteps, Math.PI + overRad, 0) };
}

function swingBlade(
  motion: WeaponMotion, swing: SwingData, alpha: number, held: BladePose,
): { blade: Vec3; edge: Vec3 | null; handBlade: Vec3; handZ: number; arcRad: number; set: number } {
  const cut = wayCut(swing.way, true), stab = swing.way === "stab", heavy = swing.attack === "heavy";
  const backRad = stab ? Math.PI / 2 : SWING_ARC.backRad * (heavy ? DRAWBACK.heavyFactor : 1);
  // A cut ending low would follow through into its own legs.
  const overRad = stab ? 0 : (heavy ? SWING_ARC.heavyOverRad : SWING_ARC.overRad) * (1 + Math.min(0, cut.y));
  const { set, arcRad } = swingArc(swing, alpha, backRad, overRad);
  if (stab) {
    const ahead = motion.stroke(cut, 0.5), pulledZ = motion.windup(cut, 1, held).handZ;
    const handZ = ahead.handZ + ((ahead.handZ - pulledZ) / 2) * (Math.sin(arcRad) - 1);
    return { blade: ahead.blade, edge: ahead.edge ?? null, handBlade: ahead.blade, handZ, arcRad, set };
  }
  const along = motion.stroke(cut, arcRad / Math.PI);
  const handBlade = motion.stroke(cut, clamp(arcRad, 0, Math.PI) / Math.PI).blade;
  return { blade: along.blade, edge: along.edge ?? null, handBlade, handZ: along.handZ, arcRad, set };
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
/** Drawn, the bow hand is this far (m) out to its side, near upright: the shoulder camera sees it all past the body. */
const BOW_DRAWN = { outM: 0.32, cantRad: 0.12 } as const;
/** How far the body turns side-on drawing, hips to chest; the neck turns back to look down the arrow. */
const DRAW_TWIST = { hips: -0.25, spine: -0.25, chest: -0.3, neck: 0.7 } as const;
const LOOSED_FLICK_M = 0.06;
/** At rest it hangs at the side, its top leaning out (`blade.x`) and ahead. */
const BOW_CARRY = { outM: 0.12, drop: 0.75, aheadM: 0.08, blade: { x: 0.1, y: 0.9, z: 0.4 } } as const;
const THIGH_M = -restAt("shin.R", "medium").y, SHIN_M = -restAt("foot.R", "medium").y;
/** After touching down the knees give by up to `crouchRad` (a crouch's thigh angle) over `durationTime`. */
export const LANDING = { durationTime: 0.22, crouchRad: 0.32 } as const;

/** How far (m) a leg's foot rises toward its hip from hanging straight. */
export function legDrop(thigh: Vec3, shin: Vec3): number {
  return THIGH_M + SHIN_M - Math.cos(thigh.z) * (THIGH_M * Math.cos(thigh.x) + SHIN_M * Math.cos(thigh.x + shin.x));
}

/** In the model's frame, feet at 0 and +z ahead. */
export interface PersonPose {
  blade: Vec3;
  /** Its hand's +x; null (a bow): turned the shortest way from upright. */
  edge: Vec3 | null;
  hand: Vec3;
  offHand: Vec3;
  off: { blade: Vec3; edge: Vec3 } | null;
  held: { way: SwingDir | null; block: GuardKind | null } | null;
  gripped: boolean;
  joints: Record<PosedJoint, Vec3>;
  /** The root's height (m), down as the knees bend so the feet stay on the ground. */
  rootY: number;
  /** Walking: the legs and root's height are exact, so a planted foot stays put. */
  legsExact: boolean;
  swing: { at: SwingData; alpha: number; set: number } | null;
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
  /** `phase` in radians, 2π a stride; `speed` m/s along `way`, a unit vector in the model's frame. */
  walk: { phase: number; speed: number; way: Vec2 };
  /** 1 on touching down, to 0 as the landing's squash ends. */
  landing?: number;
  bow?: BowLook & { drawn: number; flick?: number };
  alpha?: number;
  guard?: GuardKind | null;
  twoHanded?: boolean;
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
      if (values) joints[to][axis] += keyed(t, clip.at, values, clip.end) * (scale[name]?.[axis] ?? 1) * flip * weight;
    }
  }
}

export function personPose(
  player: Doing, wielder: Pick<WielderData, "swing">, motion: WeaponMotion, o: PersonMoment,
): PersonPose {
  const { build: b, side, alive, alpha = 1, guard: kind = null } = o, t = player.actionTime;
  const swing = alive && wielder.swing && drawnStep(wielder.swing, alpha) < wielder.swing.endAt ? wielder.swing : null;
  const blocking = alive && player.action === "block" && kind !== null && !o.bow ? kind : null;
  const guard = playerBlade(blocking ? { ...player, action: "none" } : player, { swing: null }, alive, motion);
  const swung = swing && swingBlade(motion, swing, alpha, { blade: guard.blade, handZ: guard.handZ });
  const { blade, handBlade, handZ } = swung ?? guard;
  const reach = b.reachM, scale = reach / MOTION_ARM_M;
  const pivot = { x: side * b.shoulderM * PIVOT_OUT, y: b.shoulderY - reach * PIVOT_DROP, z: 0 };
  const arc = reach * HAND_ARC;
  const joints = Object.fromEntries(POSED_JOINTS.map((j) => [j, { x: 0, y: 0, z: 0 }])) as PersonPose["joints"];
  const twist = alive && (!blocking || blocking === "shield") ? TWIST_RAD * blade.x : 0;
  const offHeld = alive && !o.bow && (kind === "dual" || kind === "shield") ? kind : null;
  if (alive) {
    for (const [j, share] of Object.entries(TWIST_SHARES)) joints[j as PosedJoint].y = share * twist;
    joints.spine.x = joints.chest.x = -BEND_RAD * blade.y / 2;
  }
  const carry = offHeld && carryPose(offHeld, side, { y: b.shoulderY, z: 0 });
  // Hanging under its shoulder, which the body's twist carries round.
  const hangX = carry ? carry.offHand.x : -side * (b.shoulderM + 0.03), hangZ = carry ? carry.offHand.z : 0.05;
  const restOff: Vec3 = {
    x: hangX * Math.cos(twist) + hangZ * Math.sin(twist),
    y: carry ? carry.offHand.y : b.shoulderY - reach * 0.95,
    z: hangZ * Math.cos(twist) - hangX * Math.sin(twist),
  };
  const p: PersonPose = {
    blade, edge: swung ? swung.edge : guard.edge,
    hand: { x: pivot.x + handBlade.x * arc, y: pivot.y + handBlade.y * arc, z: handZ * scale + handBlade.z * arc },
    offHand: restOff,
    off: carry ? carry.off : null,
    held: alive && !o.bow && !STAGGERED.includes(player.action) ? { way: player.way, block: blocking } : null,
    gripped: alive && !!o.twoHanded && !o.bow && !offHeld && !blocking,
    joints, rootY: 0, legsExact: false, swing: swing && swung && { at: swing, alpha, set: swung.set },
  };
  const towardOff = (to: Vec3) => {
    const k = keyed(t, [0], [0, 1]);
    p.offHand = { x: restOff.x + (to.x - restOff.x) * k, y: restOff.y + (to.y - restOff.y) * k,
      z: restOff.z + (to.z - restOff.z) * k };
  };

  const walking = alive && player.grounded && o.walk.speed > 0 && player.action === "none";
  if (!alive) {
    play(joints, CLIPS.defeat, o.deadTime);
  } else if (swing && swung) {
    joints.root.x -= PULL_LEAN_RAD * Math.max(0, -swung.arcRad) / SWING_ARC.backRad;
    const keys = [0, swing.driveAt, swing.liveAt, swing.liveUntil].map((step) => step * FIXED_DT);
    play(joints, { at: keys, end: swing.endAt * FIXED_DT, joints: CLIPS.swing.joints },
      drawnStep(swing, alpha) * FIXED_DT, { side });
  } else {
    switch (player.action) {
      case "dodge": {
        const clip = CLIPS.dodge;
        play(joints, clip, t, { scale: { root: { x: o.dodge.z, y: 1, z: 1 } } });
        joints.root.z -= keyed(t, clip.at, clip.joints.root.x) * o.dodge.x;
        break;
      }
      case "stagger": {
        const { at, end, joints: keys } = CLIPS.stagger, { left, of } = o.stagger;
        play(joints, { at: at.map((share) => share * of), end: end * of, joints: keys }, of - left,
          { scale: { root: { x: 1, y: 1, z: side } } });
        break;
      }
      case "block":
        play(joints, CLIPS.block, t);
        if (blocking) Object.assign(p, guardPose(blocking, side, { y: b.shoulderY, z: 0 }));
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
        if (!walking) play(joints, CLIPS.idle, 0, { side });
        if (o.bow) {
          const { x, y, z } = BOW_CARRY.blade, l = Math.hypot(x, y, z);
          p.blade = { x: (side * x) / l, y: y / l, z: z / l };
          p.hand = {
            x: side * (b.shoulderM + BOW_CARRY.outM), y: b.shoulderY - reach * BOW_CARRY.drop, z: BOW_CARRY.aheadM,
          };
        }
        break;
      case "draw":
      case "loose":
        if (o.bow) {
          drawPose(p, o.bow, b, side);
          play(joints, CLIPS.draw, player.action === "draw" ? t : 1, { side });
          if (player.action === "loose") play(joints, CLIPS.loose, t);
        }
        break;
    }
  }
  if (alive && !player.grounded) play(joints, CLIPS.airborne, 0);
  const landing = alive && player.grounded ? LANDING.crouchRad * Math.sin(Math.PI * (o.landing ?? 0)) : 0;
  if (landing && !walking) play(joints, { at: [], joints: crouch([landing]) }, 0);
  const walkY = walking ? walk(p, o.walk, b, side, (THIGH_M + SHIN_M) * (1 - Math.cos(landing))) : 0;
  if (alive && !walking) {
    const breath = breathOf(o.time);
    joints.chest.x -= BREATH.chestRad * breath;
    joints.spine.x -= BREATH.spineRad * breath;
    joints.neck.x += BREATH.neckRad * breath;
    joints.hips.z += BREATH.swayRad * breathOf(o.time / 2);
  }
  for (const s of ["R", "L"] as const) joints[`foot.${s}`].x -= joints[`thigh.${s}`].x + joints[`shin.${s}`].x;
  p.legsExact = walking;
  p.rootY = walking ? walkY
    : -Math.min(legDrop(joints["thigh.R"], joints["shin.R"]), legDrop(joints["thigh.L"], joints["shin.L"]))
      + (alive ? 0 : Math.abs(Math.sin(joints.root.z)) * b.shoulderM);
  return p;
}

function walk(
  p: PersonPose, { phase, speed, way }: PersonMoment["walk"], b: PersonBuild, side: 1 | -1, dipM: number,
): number {
  const { joints } = p, share = phase / (2 * Math.PI), amp = Math.min(1, speed / PLAYER.moveSpeed);
  const at = (keys: readonly number[], half = 0) => amp * walkKey(share + half, keys);
  joints.hips.y += at(WALK.hips);
  joints.chest.y += at(WALK.chest);
  joints.neck.y += at(WALK.neck);
  joints.root.x += amp * WALK.leanRad * way.z;
  const rootY = plantLegs(joints, share, strideOf(speed, Math.abs(way.x)), way, b.look.body, dipM);
  const scale = b.reachM / MOTION_ARM_M;
  const offHalf = side === 1 ? 0 : 0.5;
  p.offHand = { ...p.offHand, z: p.offHand.z + at(WALK.arm, offHalf) * scale };
  p.hand = { ...p.hand, z: p.hand.z + at(WALK.arm, 0.5 - offHalf) * scale * SWORD_ARM_SWING };
  return rootY;
}

function drawPose(p: PersonPose, bow: NonNullable<PersonMoment["bow"]>, b: PersonBuild, side: 1 | -1): void {
  const y = b.shoulderY + 0.04, z = b.reachM + 0.05;
  p.blade = { x: side * Math.sin(BOW_DRAWN.cantRad), y: Math.cos(BOW_DRAWN.cantRad), z: 0 };
  p.hand = { x: side * BOW_DRAWN.outM, y, z };
  const back = bow.braceM + bow.drawM * bow.drawn;
  p.offHand = { x: p.hand.x - side * LOOSED_FLICK_M * (bow.flick ?? 0), y, z: z - back };
  for (const [j, turn] of Object.entries(DRAW_TWIST)) p.joints[j as PosedJoint].y = side * turn;
  p.joints.spine.x = p.joints.chest.x = 0;
}
