import { Color3, Quaternion, Vector3, type TransformNode } from "@babylonjs/core";
import {
  Body, damp, dampFactor, Health, heldIn, weaponItemIn, WEAPONS, Wielder, wrapAngle, type Entity, type Look,
  type PlayerData, type Vec2, type Vec3, type WeaponId, type World,
} from "@infinite-tower/shared";
import { reachArm } from "../arm.js";
import { dropBlade, holdBlade, showCue, type HeldBlade } from "../blade.js";
import { bowDrawOf, pullString } from "../bow.js";
import type { ArenaScene } from "../scene.js";
import { MOTIONS, WEAPON_LOOKS } from "../weapons.js";
import { buildPerson, disposePerson, FILL_EMISSIVE, personBuild, type PersonBuild, type PersonModel } from "./model.js";
import { personPose, POSED_JOINTS } from "./pose.js";
import { restAt, type Joints } from "./skeleton.js";

const HIT_FLASH_COLOR = new Color3(0.9, 0.9, 0.9);
const JOINT_RATE = 30;
const YAW_RATE = 15;
/** A two-handed grip's off hand, this far (m) down the grip from the sword hand. */
const OFF_GRIP_M = 0.18;
const UPPER_ARM_M = -restAt("forearm.R", "medium").y, FOREARM_M = -restAt("hand.R", "medium").y;

export interface PersonDrawing {
  look: Look | null;
  build: PersonBuild | null;
  model: PersonModel | null;
  blade: HeldBlade | null;
  bladeSide: 1 | -1;
  /** In the root's frame, eased toward the pose. */
  handAt: Vector3 | null;
  bladeTurn: Quaternion | null;
  yaw: number;
  gait: number;
  deadTime: number;
  sinceStep: number;
}

export type PersonStance = Pick<PlayerData, "action" | "actionTime" | "actionDir" | "way" | "grounded"> & {
  aim: Vec2;
};

export const newPerson = (): PersonDrawing => ({
  look: null, build: null, model: null, blade: null, bladeSide: 1, handAt: null, bladeTurn: null, yaw: 0, gait: 0,
  deadTime: 0, sinceStep: 0,
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

/** `target`, `holding` (the hand's +y) and `pole` are in the root's frame, as the pose gives them. */
export function reachWith(joints: Joints, side: "R" | "L", target: Vec3, holding: Quaternion, pole: Vec3): void {
  const upper = joints[`upper_arm.${side}`], fore = joints[`forearm.${side}`], hand = joints[`hand.${side}`];
  for (const j of ["root", "hips", "spine", "chest"] as const) joints[j].computeWorldMatrix(true);
  const root = joints.root.getWorldMatrix();
  upper.computeWorldMatrix(true);
  shoulderAt.copyFrom(upper.getAbsolutePosition());
  Vector3.TransformCoordinatesToRef(targetAt.set(target.x, target.y, target.z), root, targetAt);
  Vector3.TransformNormalToRef(poleAt.set(pole.x, pole.y, pole.z), root, poleAt);
  const reach = reachArm(shoulderAt, targetAt, { upperM: UPPER_ARM_M, foreM: FOREARM_M }, poleAt);
  elbowAt.set(reach.elbow.x, reach.elbow.y, reach.elbow.z);
  aimBone(upper, shoulderAt, elbowAt);
  aimBone(fore, elbowAt, targetAt.set(reach.hand.x, reach.hand.y, reach.hand.z));
  joints.root.absoluteRotationQuaternion.multiplyToRef(holding, want);
  turnInParent(hand, want);
}

const bladeDir = new Vector3(), bladeTurn = new Quaternion(), target = new Vector3(), offTarget = new Vector3();
const up = Vector3.Up(), UNTURNED = Quaternion.Identity();

export function framePerson(
  p: PersonDrawing, ctx: ArenaScene, node: TransformNode, world: World, e: Entity, dt: number, stance: PersonStance,
  stagger: { left: number; of: number },
): void {
  const look = ctx.looks.get(e)?.current ?? null;
  if (look !== p.look) {
    dropPerson(p);
    p.look = look;
    p.build = look && personBuild(look);
    p.model = p.build && buildPerson(ctx, e, node, p.build);
  }
  const { model, build } = p;
  if (!model || !build) return;
  const body = world.require(e, Body), health = world.require(e, Health), wielder = world.require(e, Wielder);
  const alive = health.hp > health.floor, weapon = weaponItemIn(wielder.hands);
  const side = weapon && heldIn(wielder.hands, weapon) === "leftHand" ? -1 : 1;
  const speed = Math.hypot(body.vel.x, body.vel.z);
  p.gait += dt * speed * 2.6;
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
  const cos = Math.cos(p.yaw), sin = Math.sin(p.yaw), d = stance.actionDir;
  const held = weapon && WEAPON_LOOKS[weapon], drawing = bowDrawOf(world, e);
  const pose = personPose(stance, wielder, MOTIONS[weapon ? WEAPONS[weapon].kind : "sword"], {
    build, side, alive, dodge: { x: d.x * cos - d.z * sin, z: d.x * sin + d.z * cos },
    stagger, deadTime: p.deadTime,
    walk: { phase: p.gait, amp: Math.min(0.7, speed * 0.12) },
    ...(held?.bow && drawing && { bow: { ...held.bow, drawn: drawing.drawn } }),
  });

  const { joints } = model, ease = (current: number, to: number) => damp(current, to, JOINT_RATE, shownDt);
  for (const name of POSED_JOINTS) {
    const r = joints[name].rotation, to = pose.joints[name];
    r.set(ease(r.x, to.x), ease(r.y, to.y), ease(r.z, to.z));
  }
  joints.root.position.y = ease(joints.root.position.y, pose.rootY);

  const swordSide = side === 1 ? "R" : "L", offSide = side === 1 ? "L" : "R";
  const snap = pose.bladeExact ? 1 : dampFactor(JOINT_RATE, shownDt);
  Quaternion.FromUnitVectorsToRef(up, bladeDir.set(pose.blade.x, pose.blade.y, pose.blade.z), bladeTurn);
  p.bladeTurn ??= bladeTurn.clone();
  Quaternion.SlerpToRef(p.bladeTurn, bladeTurn, snap, p.bladeTurn);
  target.set(pose.hand.x, pose.hand.y, pose.hand.z);
  p.handAt ??= target.clone();
  Vector3.LerpToRef(p.handAt, target, snap, p.handAt);
  reachWith(joints, swordSide, p.handAt, p.bladeTurn, { x: side * 0.5, y: -0.8, z: -0.45 });
  if (p.blade?.bow) pullString(p.blade.bow, drawing?.drawn ?? 0, alive && (drawing?.nocked ?? false));
  if (held && held.twoHanded && !held.bow && alive) {
    up.applyRotationQuaternionToRef(p.bladeTurn, bladeDir);
    p.handAt.subtractToRef(bladeDir.scaleInPlace(OFF_GRIP_M), offTarget);
    reachWith(joints, offSide, offTarget, p.bladeTurn, { x: -side * 0.5, y: -0.8, z: -0.45 });
  } else {
    offTarget.set(pose.offHand.x, pose.offHand.y, pose.offHand.z);
    reachWith(joints, offSide, offTarget, UNTURNED, { x: -side * 0.5, y: -0.8, z: -0.45 });
  }
}

function placeBladeIn(
  p: PersonDrawing, ctx: ArenaScene, e: Entity, model: PersonModel, weapon: WeaponId | null, side: 1 | -1,
): void {
  dropBlade(p.blade);
  p.blade = weapon && holdBlade(ctx, e, model.joints[side === 1 ? "grip.R" : "grip.L"], weapon, 0);
  p.bladeSide = side;
}
