import { Color3, Quaternion, Vector3, type TransformNode } from "@babylonjs/core";
import {
  Body, damp, dampFactor, Health, heldIn, weaponItemIn, WEAPONS, Wielder, wrapAngle, type Entity, type Look,
  type PlayerData, type Vec2, type WeaponId, type World,
} from "@infinite-tower/shared";
import { poseArm } from "../arm.js";
import { dropBlade, holdBlade, showCue, type HeldBlade } from "../blade.js";
import type { ArenaScene } from "../scene.js";
import { MOTIONS, WEAPON_LOOKS } from "../weapons.js";
import { buildPerson, disposePerson, personBuild, type PersonBuild, type PersonModel } from "./model.js";
import { personPose } from "./pose.js";

const HIT_FLASH_COLOR = new Color3(0.9, 0.9, 0.9);
const JOINT_RATE = 30;
const YAW_RATE = 15;
const HEAD_COUNTER = 0.6;
/** A two-handed grip's off hand, this far (m) down the grip from the sword hand. */
const OFF_GRIP_M = 0.18;
const bladeDir = new Vector3(), bladeTurn = new Quaternion(), target = new Vector3(), offTarget = new Vector3();

export interface PersonDrawing {
  look: Look | null;
  build: PersonBuild | null;
  model: PersonModel | null;
  blade: HeldBlade | null;
  bladeSide: 1 | -1;
  handAt: Vector3 | null;
  yaw: number;
  gait: number;
  deadTime: number;
  sinceStep: number;
}

export type PersonStance = Pick<PlayerData, "action" | "actionTime" | "actionDir" | "way" | "grounded"> & {
  aim: Vec2;
};

export const newPerson = (): PersonDrawing => ({
  look: null, build: null, model: null, blade: null, bladeSide: 1, handAt: null, yaw: 0, gait: 0, deadTime: 0,
  sinceStep: 0,
});

export function dropPerson(p: PersonDrawing): void {
  dropBlade(p.blade);
  p.blade = null;
  if (p.model) disposePerson(p.model);
  p.model = null;
}

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

  model.root.setEnabled(!(alive && health.invuln > 0 && Math.floor(health.invuln * 16) % 2 === 1));
  for (const m of model.materials) m.emissiveColor.copyFrom(health.flash > 0 ? HIT_FLASH_COLOR : Color3.Black());
  if (p.blade) showCue(p.blade.cue, alive ? wielder.swing : null);

  const steps = ctx.pixel.steps;
  p.sinceStep += dt;
  if (steps !== null && p.sinceStep < 1 / steps) return;
  const shownDt = p.sinceStep;
  p.sinceStep = steps === null ? 0 : p.sinceStep % (1 / steps);

  if (weapon !== p.blade?.weapon || side !== p.bladeSide) placeBladeIn(p, ctx, e, model, weapon, side);
  const facing = wielder.swing?.dir ?? stance.aim;
  p.yaw += wrapAngle(Math.atan2(facing.x, facing.z) - p.yaw) * dampFactor(YAW_RATE, shownDt);
  model.root.rotation.y = p.yaw;
  const cos = Math.cos(p.yaw), sin = Math.sin(p.yaw), d = stance.actionDir;
  const pose = personPose(stance, wielder, MOTIONS[weapon ? WEAPONS[weapon].kind : "sword"], {
    build, side, alive, dodge: { x: d.x * cos - d.z * sin, z: d.x * sin + d.z * cos },
    stagger, deadTime: p.deadTime,
    walk: { phase: p.gait, amp: Math.min(0.7, speed * 0.12) },
  });

  const ease = (current: number, to: number) => damp(current, to, JOINT_RATE, shownDt);
  model.hips.rotation.y = ease(model.hips.rotation.y, pose.hipTwist);
  model.chest.rotation.y = ease(model.chest.rotation.y, pose.twist);
  model.chest.rotation.x = ease(model.chest.rotation.x, pose.bend);
  model.head.rotation.y = -model.chest.rotation.y * HEAD_COUNTER;
  model.model.rotation.x = ease(model.model.rotation.x, pose.lean);
  model.model.rotation.z = ease(model.model.rotation.z, pose.roll);
  model.model.position.y = ease(model.model.position.y, pose.yOff);
  model.legs.forEach((leg, i) => {
    const swing = (i === 0 ? 1 : -1) * pose.legSwing;
    leg.hip.rotation.x = ease(leg.hip.rotation.x, swing - pose.crouch);
    leg.knee.rotation.x = ease(leg.knee.rotation.x, 2 * pose.crouch + Math.max(0, -swing) * 0.6);
  });

  const [right, left] = model.arms, swordArm = side === 1 ? right : left, offArm = side === 1 ? left : right;
  const hand = swordArm.hand, snap = pose.bladeExact ? 1 : dampFactor(JOINT_RATE, shownDt);
  Quaternion.FromUnitVectorsToRef(Vector3.Up(), bladeDir.set(pose.blade.x, pose.blade.y, pose.blade.z), bladeTurn);
  hand.rotationQuaternion ??= bladeTurn.clone();
  Quaternion.SlerpToRef(hand.rotationQuaternion, bladeTurn, snap, hand.rotationQuaternion);
  target.set(pose.hand.x, pose.hand.y, pose.hand.z);
  p.handAt ??= target.clone();
  Vector3.LerpToRef(p.handAt, target, snap, p.handAt);
  poseArm(swordArm, p.handAt);
  if (weapon && WEAPON_LOOKS[weapon].twoHanded && alive) {
    Vector3.Up().applyRotationQuaternionToRef(hand.rotationQuaternion, bladeDir);
    hand.position.subtractToRef(bladeDir.scaleInPlace(OFF_GRIP_M), offTarget);
    offArm.hand.rotationQuaternion ??= new Quaternion();
    offArm.hand.rotationQuaternion.copyFrom(hand.rotationQuaternion);
  } else {
    offTarget.set(pose.offHand.x, pose.offHand.y, pose.offHand.z);
  }
  poseArm(offArm, offTarget);
}

function placeBladeIn(
  p: PersonDrawing, ctx: ArenaScene, e: Entity, model: PersonModel, weapon: WeaponId | null, side: 1 | -1,
): void {
  dropBlade(p.blade);
  const hand = model.arms[side === 1 ? 0 : 1].hand;
  p.blade = weapon && holdBlade(ctx, e, hand, weapon, 0);
  p.bladeSide = side;
}
