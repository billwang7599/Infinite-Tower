import { Color3, Matrix, Quaternion, Vector3, type TransformNode } from "@babylonjs/core";
import {
  Body, damp, dampFactor, Health, Player, weaponHandIn, weaponItemIn, WEAPONS, Wielder, wrapAngle, type Entity,
  type Equipment, type Hands, type Look, type PlayerData, type SwingData, type Vec2, type Vec3, type WeaponId,
  type World,
} from "@infinite-tower/shared";
import { BATTLE_BUILDS } from "../../../gfx/look/body.js";
import { reachArm, reachRound, type BladeReach, type Clearance } from "../arm.js";
import { BLADE_FROM_M, dropBlade, holdBlade, showCue, type HeldBlade } from "../blade.js";
import { pullString } from "../bow.js";
import { bowDrawOf, moveBow, restingBow, type BowMotion } from "../bowMotion.js";
import type { ArenaScene } from "../scene.js";
import { MOTIONS, WEAPON_LOOKS, type WeaponLook } from "../weapons.js";
import { SHAPES, shownGear, wearOf, type ShownGear } from "./body.js";
import { ROUNDNESS, type Section } from "./loft.js";
import {
  buildPerson, disposePerson, FILL_EMISSIVE, personBuild, toMetres, type PersonBuild, type PersonModel,
} from "./model.js";
import { STILL_HAIR, strideOf, swayHair, type Sway } from "./motion.js";
import { LANDING, personPose, POSED_JOINTS, type PersonPose } from "./pose.js";
import { M_PER_PX, restAt, type JointName, type Joints } from "./skeleton.js";

const HIT_FLASH_COLOR = new Color3(0.9, 0.9, 0.9);
export const JOINT_RATE = 30;
const YAW_RATE = 15;
/** A two-handed grip's off hand, this far (m) down the grip from the sword hand. */
export const OFF_GRIP_M = 0.1;
const UPPER_ARM_M = -restAt("forearm.R", "medium").y, FOREARM_M = -restAt("hand.R", "medium").y;
const LEGS = new Set<string>(["thigh.R", "thigh.L", "shin.R", "shin.L", "foot.R", "foot.L"]);

export interface PersonDrawing {
  look: Look | null;
  equipment: Equipment | null;
  shown: ShownGear;
  build: PersonBuild | null;
  model: PersonModel | null;
  blade: HeldBlade | null;
  bladeSide: 1 | -1;
  /** In the root's frame, eased toward the pose. */
  handAt: Vector3 | null;
  bladeTurn: Quaternion | null;
  swungFrom: { swing: SwingData; hand: Vector3; turn: Quaternion } | null;
  yaw: number;
  gait: number;
  time: number;
  deadTime: number;
  sinceStep: number;
  /** Seconds since it last touched down; null in the air. */
  sinceLanding: number | null;
  hair: { sway: Sway; at: Vector3 | null; vel: Vector3 };
  bow: BowMotion;
  pose: PersonPose | null;
  inView: InView | null;
}

export interface HeldArms { hand: Vector3; holding: Quaternion; offHand: Vector3; offHolding: Quaternion }
export interface InView extends HeldArms { from: (HeldArms & { swing: SwingData | null; sinceTime: number }) | null }

export type PersonStance = Pick<PlayerData, "action" | "actionTime" | "actionDir" | "way" | "grounded"> & {
  aim: Vec2;
};

export const newPerson = (): PersonDrawing => ({
  look: null, equipment: null, shown: {}, build: null, model: null, blade: null, bladeSide: 1, handAt: null,
  bladeTurn: null, swungFrom: null, yaw: 0, gait: 0, time: 0, deadTime: 0, sinceStep: 0,
  sinceLanding: LANDING.durationTime, hair: { sway: STILL_HAIR, at: null, vel: Vector3.Zero() }, bow: restingBow(),
  pose: null, inView: null,
});

export function dropPerson(p: PersonDrawing): void {
  dropBlade(p.blade);
  p.blade = null;
  if (p.model) disposePerson(p.model);
  p.model = null;
}

const down = new Vector3(0, -1, 0), dir = new Vector3(), want = new Quaternion(), parentTurn = new Quaternion();
const shoulderAt = new Vector3(), targetAt = new Vector3(), poleAt = new Vector3(), elbowAt = new Vector3();

function turnInParent(bone: TransformNode, world: Quaternion): void {
  const parent = bone.parent as TransformNode;
  parent.computeWorldMatrix(true);
  Quaternion.InverseToRef(parent.absoluteRotationQuaternion, parentTurn);
  bone.rotationQuaternion ??= new Quaternion();
  parentTurn.multiplyToRef(world, bone.rotationQuaternion);
  bone.computeWorldMatrix(true);
}

function aimBone(bone: TransformNode, from: Vector3, to: Vector3): void {
  to.subtractToRef(from, dir).normalize();
  Quaternion.FromUnitVectorsToRef(down, dir, want);
  turnInParent(bone, want);
}

const TORSO = ["ribs", "belly", "pelvis"] as const;
// Above where the deltoid ends, the upper arm is the shoulder's joint.
const UPPER_FROM = SHAPES.shoulder.sections(BATTLE_BUILDS.medium)[0]!.y / -(UPPER_ARM_M / M_PER_PX);
interface Torso extends Omit<Clearance, "body" | "upperFrom"> {
  parts: { joint: JointName; sections: Section[]; roundness: number }[];
}
const TORSOS = Object.fromEntries(Object.entries(BATTLE_BUILDS).map(([body, b]) => {
  const thickest = (part: "upperArm" | "forearm" | "hand") =>
    Math.max(...SHAPES[part].sections(b).flatMap((s) => [s.x, s.z])) * M_PER_PX;
  const parts = TORSO.map((part) => ({
    joint: SHAPES[part].joints[0]!, sections: SHAPES[part].sections(b).map(toMetres),
    roundness: SHAPES[part].roundness ?? ROUNDNESS,
  }));
  return [body, { parts, upperM: thickest("upperArm"), foreM: thickest("forearm"), handM: thickest("hand") }];
})) as Record<Look["body"], Torso>;
const clearances = new WeakMap<Joints, Clearance>();

function clearanceOf(joints: Joints, type: Look["body"]): Clearance {
  let c = clearances.get(joints);
  if (!c) {
    const { parts, ...thick } = TORSOS[type];
    const body = parts.map(({ joint, ...part }) => ({ node: joints[joint], ...part }));
    c = { ...thick, upperFrom: UPPER_FROM, body };
    clearances.set(joints, c);
  }
  return c;
}

const ahead = new Vector3(), bladeWay = new Vector3();

export function reachWith(
  joints: Joints, body: Look["body"], side: "R" | "L", target: Vec3, holding: Quaternion, pole: Vec3,
  blade: BladeReach | null = null, clear = true,
): void {
  const upper = joints[`upper_arm.${side}`], fore = joints[`forearm.${side}`], hand = joints[`hand.${side}`];
  for (const j of ["root", "hips", "spine", "chest"] as const) joints[j].computeWorldMatrix(true);
  const root = joints.root.getWorldMatrix();
  upper.computeWorldMatrix(true);
  shoulderAt.copyFrom(upper.getAbsolutePosition());
  Vector3.TransformCoordinatesToRef(targetAt.set(target.x, target.y, target.z), root, targetAt);
  Vector3.TransformNormalToRef(poleAt.set(pole.x, pole.y, pole.z), root, poleAt);
  Vector3.TransformNormalToRef(Vector3.Forward(), joints.chest.getWorldMatrix(), ahead);
  joints.root.absoluteRotationQuaternion.multiplyToRef(holding, want);
  Vector3.Up().applyRotationQuaternionToRef(want, bladeWay);
  const bones = { upperM: UPPER_ARM_M, foreM: FOREARM_M };
  const reach = clear ? reachRound(shoulderAt, targetAt, bones, poleAt, clearanceOf(joints, body), ahead,
    blade && { ...blade, way: bladeWay }) : reachArm(shoulderAt, targetAt, bones, poleAt);
  elbowAt.set(reach.elbow.x, reach.elbow.y, reach.elbow.z);
  aimBone(upper, shoulderAt, elbowAt);
  aimBone(fore, elbowAt, targetAt.set(reach.hand.x, reach.hand.y, reach.hand.z));
  joints.root.absoluteRotationQuaternion.multiplyToRef(holding, want);
  turnInParent(hand, want);
}

// A bow is always in the left hand: the locked camera looks over the left shoulder.
export const handSide = (hands: Hands, weapon: WeaponId | null): 1 | -1 =>
  weapon && (WEAPON_LOOKS[weapon].bow || weaponHandIn(hands) === "leftHand") ? -1 : 1;

const bladeDir = new Vector3(), bladeTurn = new Quaternion(), target = new Vector3(), offTarget = new Vector3();
const up = Vector3.Up(), UNTURNED = Quaternion.Identity();

export function framePerson(
  p: PersonDrawing, ctx: ArenaScene, node: TransformNode, world: World, e: Entity, dt: number, stance: PersonStance,
  stagger: { left: number; of: number },
): void {
  const look = ctx.looks.get(e)?.current ?? null, equipment = world.get(e, Player)?.gear.equipment ?? null;
  const shown = equipment === p.equipment ? p.shown : equipment ? shownGear(equipment) : {};
  p.equipment = equipment;
  if (look !== p.look || (shown !== p.shown && JSON.stringify(shown) !== JSON.stringify(p.shown))) {
    dropPerson(p);
    p.look = look;
    p.shown = shown;
    p.build = look && personBuild(look);
    p.model = p.build && buildPerson(ctx, e, node, p.build, wearOf(shown));
  }
  const { model, build } = p;
  if (!model || !build) return;
  const body = world.require(e, Body), health = world.require(e, Health), wielder = world.require(e, Wielder);
  const alive = health.hp > health.floor, weapon = weaponItemIn(wielder.hands);
  const side = handSide(wielder.hands, weapon);
  const speed = Math.hypot(body.vel.x, body.vel.z);
  p.time += dt;
  p.sinceLanding = stance.grounded ? (p.sinceLanding ?? 0) + dt : null;
  p.deadTime = alive ? 0 : p.deadTime + dt;

  model.holder.setEnabled(!(alive && health.invuln > 0 && Math.floor(health.invuln * 16) % 2 === 1));
  for (const m of model.materials) m.emissiveColor.copyFrom(health.flash > 0 ? HIT_FLASH_COLOR : FILL_EMISSIVE);
  if (p.blade) showCue(p.blade.cue, alive ? wielder.swing : null);

  const steps = ctx.pixel.steps;
  p.sinceStep += dt;
  if (steps !== null && p.sinceStep < 1 / steps) return;
  const shownDt = p.sinceStep;
  p.sinceStep = steps === null ? 0 : p.sinceStep % (1 / steps);

  if (weapon !== p.blade?.weapon || side !== p.bladeSide) placeBladeIn(p, ctx, e, model, weapon, side);
  const facing = wielder.swing?.dir ?? stance.aim;
  p.yaw += wrapAngle(Math.atan2(facing.x, facing.z) - p.yaw) * dampFactor(YAW_RATE, shownDt);
  model.holder.rotation.y = p.yaw;
  const cos = Math.cos(p.yaw), sin = Math.sin(p.yaw), d = stance.actionDir, v = body.vel;
  const way = speed > 0 ? { x: (v.x * cos - v.z * sin) / speed, z: (v.x * sin + v.z * cos) / speed } : { x: 0, z: 1 };
  p.gait += shownDt * 2 * Math.PI * strideOf(speed, Math.abs(way.x)).cyclesPerSec;
  const held = weapon && WEAPON_LOOKS[weapon], drawing = alive ? bowDrawOf(world, e) : null;
  moveBow(p.bow, drawing, shownDt);
  const pose = personPose(stance, wielder, MOTIONS[weapon ? WEAPONS[weapon].kind : "sword"], {
    build, side, alive, dodge: { x: d.x * cos - d.z * sin, z: d.x * sin + d.z * cos },
    stagger, deadTime: p.deadTime, time: p.time,
    walk: { phase: p.gait, speed, way },
    landing: p.sinceLanding === null ? 0 : Math.max(0, 1 - p.sinceLanding / LANDING.durationTime),
    ...(held?.bow && drawing && { bow: { ...held.bow, drawn: p.bow.hand, flick: p.bow.flick } }),
    alpha: ctx.battle.blend.alpha,
  });
  p.pose = pose;

  const { joints } = model;
  for (const name of POSED_JOINTS) {
    const exact = pose.legsExact && LEGS.has(name);
    const ease = (current: number, to: number) => exact ? to : damp(current, to, JOINT_RATE, shownDt);
    const r = joints[name].rotation, to = pose.joints[name];
    r.set(ease(r.x, to.x), ease(r.y, to.y), ease(r.z, to.z));
  }
  joints.root.position.y = pose.legsExact ? pose.rootY : damp(joints.root.position.y, pose.rootY, JOINT_RATE, shownDt);

  Quaternion.FromUnitVectorsToRef(up, bladeDir.set(pose.blade.x, pose.blade.y, pose.blade.z), bladeTurn);
  target.set(pose.hand.x, pose.hand.y, pose.hand.z);
  p.bladeTurn ??= bladeTurn.clone();
  p.handAt ??= target.clone();
  const swung = pose.swing;
  if (swung?.at !== p.swungFrom?.swing) {
    p.swungFrom = swung && { swing: swung.at, hand: p.handAt.clone(), turn: p.bladeTurn.clone() };
  }
  if (swung && p.swungFrom) {
    Quaternion.SlerpToRef(p.swungFrom.turn, bladeTurn, swung.set, p.bladeTurn);
    Vector3.LerpToRef(p.swungFrom.hand, target, swung.set, p.handAt);
  } else {
    Quaternion.SlerpToRef(p.bladeTurn, bladeTurn, dampFactor(JOINT_RATE, shownDt), p.bladeTurn);
    Vector3.LerpToRef(p.handAt, target, dampFactor(JOINT_RATE, shownDt), p.handAt);
  }
  reachArms(joints, build.look.body, side, p.handAt, p.bladeTurn, pose.offHand, alive ? held : null);
  if (p.blade?.bow) pullString(p.blade.bow, p.bow.string, drawing?.nocked ?? false);
  swing(p, joints, shownDt);
}

export const ARM_POLE: Vec3 = { x: 0.5, y: -0.8, z: -0.45 };

export const bladeReach = (held: WeaponLook | null): BladeReach | null => held && !held.bow
  ? { fromM: BLADE_FROM_M, toM: BLADE_FROM_M + held.blade.lengthM, halfM: held.blade.widthM / 2 } : null;

const fromWorld = new Matrix();

export function reachArms(
  joints: Joints, body: Look["body"], side: 1 | -1, hand: Vector3, bladeTurn: Quaternion, offHand: Vec3,
  held: WeaponLook | null,
): void {
  const swordSide = side === 1 ? "R" : "L", offSide = side === 1 ? "L" : "R";
  const pole = (s: 1 | -1) => ({ x: s * ARM_POLE.x, y: ARM_POLE.y, z: ARM_POLE.z });
  reachWith(joints, body, swordSide, hand, bladeTurn, pole(side), bladeReach(held));
  if (held && held.twoHanded && !held.bow) {
    joints.root.getWorldMatrix().invertToRef(fromWorld);
    Vector3.TransformCoordinatesToRef(joints[`hand.${swordSide}`].getAbsolutePosition(), fromWorld, offTarget);
    up.applyRotationQuaternionToRef(bladeTurn, bladeDir);
    offTarget.subtractInPlace(bladeDir.scaleInPlace(OFF_GRIP_M));
    reachWith(joints, body, offSide, offTarget, bladeTurn, pole(-side as 1 | -1));
  } else {
    offTarget.set(offHand.x, offHand.y, offHand.z);
    reachWith(joints, body, offSide, offTarget, UNTURNED, pole(-side as 1 | -1));
  }
}

const headAt = new Vector3(), headVel = new Vector3(), headTurn = new Quaternion();
const localDown = new Vector3(), localAccel = new Vector3();
/** A longer gap than this (s) is a pause or a jump in place: the hair starts again from still. */
const HAIR_GAP_TIME = 0.1;

function swing(p: PersonDrawing, joints: Joints, dt: number): void {
  joints.neck.computeWorldMatrix(true);
  joints.head.computeWorldMatrix(true);
  headAt.copyFrom(joints.head.getAbsolutePosition());
  const hair = p.hair;
  if (!hair.at || dt <= 0 || dt > HAIR_GAP_TIME) {
    hair.at = headAt.clone();
    hair.vel.setAll(0);
    return;
  }
  headAt.subtractToRef(hair.at, headVel).scaleInPlace(1 / dt);
  headVel.subtractToRef(hair.vel, localAccel).scaleInPlace(1 / dt);
  hair.at.copyFrom(headAt);
  hair.vel.copyFrom(headVel);
  Quaternion.InverseToRef(joints.head.absoluteRotationQuaternion, headTurn);
  down.applyRotationQuaternionToRef(headTurn, localDown);
  localAccel.applyRotationQuaternionToRef(headTurn, localAccel);
  hair.sway = swayHair(hair.sway, localDown, localAccel, dt);
  joints.hair.rotation.set(hair.sway.x, 0, hair.sway.z);
}

function placeBladeIn(
  p: PersonDrawing, ctx: ArenaScene, e: Entity, model: PersonModel, weapon: WeaponId | null, side: 1 | -1,
): void {
  dropBlade(p.blade);
  p.blade = weapon && holdBlade(ctx, e, model.joints[side === 1 ? "grip.R" : "grip.L"], weapon, 0);
  p.bladeSide = side;
}
