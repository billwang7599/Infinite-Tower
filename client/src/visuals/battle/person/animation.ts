import { Color3, Matrix, Quaternion, Vector3, type TransformNode } from "@babylonjs/core";
import {
  Body, damp, dampFactor, guardOf, Health, itemDef, Player, smoothstep, weaponHandIn, weaponItemIn, WEAPONS, Wielder,
  wrapAngle, type Entity, type Equipment, type Hands, type ItemId, type Look, type PlayerData, type SwingData,
  type Vec2, type Vec3, type WeaponId, type World,
} from "@infinite-tower/shared";
import { BATTLE_BUILDS } from "../../../gfx/look/body.js";
import { reachArm, reachRound, type BladeReach, type Clearance } from "../arm.js";
import {
  BLADE_FROM_M, dropBlade, dropShield, holdBlade, holdingOf, holdShield, showCue, type HeldBlade, type HeldShield,
} from "../blade.js";
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
  offBlade: HeldBlade | null;
  shield: HeldShield | null;
  bladeSide: 1 | -1;
  /** In the root's frame, eased toward the pose. */
  held: ShownArms | null;
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
  inView: ShownArms | null;
}

export interface HeldArms { hand: Vector3; holding: Quaternion; offHand: Vector3; offHolding: Quaternion }
export interface ShownArms extends HeldArms {
  key: string;
  side: 1 | -1;
  from: (HeldArms & { swing: SwingData | null; sinceTime: number; time: number }) | null;
}

export const GUARD_SHIFT = { time: 0.1, timePerHeft: 0.08 } as const;
export const guardShiftTime = (heft: number): number =>
  GUARD_SHIFT.time + Math.max(0, heft - WEAPONS.sword.heft) * GUARD_SHIFT.timePerHeft;

export function shiftTimeOf(p: PersonDrawing): number {
  const shield = p.pose?.held?.block === "shield" && p.shield && itemDef(p.shield.item).shield;
  return guardShiftTime(shield ? shield.heft : p.blade ? WEAPONS[p.blade.weapon].heft : 1);
}

export const heldKey = (pose: PersonPose): string => pose.held ? `${pose.held.block ?? ""}:${pose.held.way ?? ""}` : "";

const copyArms = (a: HeldArms): HeldArms =>
  ({ hand: a.hand.clone(), holding: a.holding.clone(), offHand: a.offHand.clone(), offHolding: a.offHolding.clone() });

export function easeArms(
  shown: ShownArms | null, want: HeldArms,
  o: { key: string; side: 1 | -1; swung: { swing: SwingData; set: number } | null; shiftTime: number;
    returnTime: number; dt: number },
): ShownArms {
  const now = shown ?? { ...copyArms(want), key: o.key, side: o.side, from: null };
  if (now.side !== o.side) {
    [now.hand, now.offHand, now.holding, now.offHolding] = [now.offHand, now.hand, now.offHolding, now.holding];
    Object.assign(now, { side: o.side, key: "", from: null });
  }
  const begin = (swing: SwingData | null, time: number) => {
    now.from = { ...copyArms(now), swing, sinceTime: 0, time };
  };
  if (o.swung) {
    if (now.from?.swing !== o.swung.swing) begin(o.swung.swing, 0);
  } else if (now.from?.swing) begin(null, o.returnTime);
  else if (o.key !== now.key) begin(null, o.shiftTime);
  now.key = o.key;
  if (!o.swung && now.from && (now.from.sinceTime += o.dt) >= now.from.time) now.from = null;
  const from = now.from ?? now;
  const k = o.swung ? o.swung.set : now.from ? smoothstep(0, now.from.time, now.from.sinceTime)
    : dampFactor(JOINT_RATE, o.dt);
  Vector3.LerpToRef(from.hand, want.hand, k, now.hand);
  turnToward(from.holding, want.holding, k, now.holding, !o.swung);
  Vector3.LerpToRef(from.offHand, want.offHand, k, now.offHand);
  turnToward(from.offHolding, want.offHolding, k, now.offHolding, !o.swung);
  return now;
}

// Within this of a half turn (a quaternion dot) either way round is as short: a shift goes over the top.
const HALF_TURN_DOT = 0.26;
const halfway = new Quaternion(), halfUp = new Vector3();

function slerpRound(from: Quaternion, to: Quaternion, sign: number, k: number, out: Quaternion): Quaternion {
  const angle = Math.acos(Math.max(-1, Math.min(1, Quaternion.Dot(from, to) * sign))), s = Math.sin(angle);
  const a = s < 1e-6 ? 1 - k : Math.sin((1 - k) * angle) / s, b = (s < 1e-6 ? k : Math.sin(k * angle) / s) * sign;
  return out.copyFromFloats(from.x * a + to.x * b, from.y * a + to.y * b, from.z * a + to.z * b, from.w * a + to.w * b);
}

function turnToward(from: Quaternion, to: Quaternion, k: number, out: Quaternion, overTop: boolean): void {
  const d = Quaternion.Dot(from, to);
  let sign = d < 0 ? -1 : 1;
  if (overTop && Math.abs(d) < HALF_TURN_DOT) {
    const upAt = (s: number) => Vector3.UpReadOnly.applyRotationQuaternionToRef(
      slerpRound(from, to, s, 0.5, halfway), halfUp).y;
    if (upAt(-sign) > upAt(sign)) sign = -sign;
  }
  slerpRound(from, to, sign, k, out);
}

export type PersonStance = Pick<PlayerData, "action" | "actionTime" | "actionDir" | "way" | "grounded"> & {
  aim: Vec2;
};

export const newPerson = (): PersonDrawing => ({
  look: null, equipment: null, shown: {}, build: null, model: null, blade: null, offBlade: null, shield: null,
  bladeSide: 1, held: null, yaw: 0, gait: 0, time: 0, deadTime: 0, sinceStep: 0,
  sinceLanding: LANDING.durationTime, hair: { sway: STILL_HAIR, at: null, vel: Vector3.Zero() }, bow: restingBow(),
  pose: null, inView: null,
});

export function dropPerson(p: PersonDrawing): void {
  dropBlade(p.blade);
  dropBlade(p.offBlade);
  dropShield(p.shield);
  p.blade = p.offBlade = p.shield = null;
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

const isShield = (item: ItemId | null): boolean => !!item && !!itemDef(item).shield;

// A bow is always in the left hand: the locked camera looks over the left shoulder. A shield is always the other one.
export const handSide = (hands: Hands, weapon: WeaponId | null): 1 | -1 =>
  weapon ? (WEAPON_LOOKS[weapon].bow || weaponHandIn(hands) === "leftHand" ? -1 : 1)
    : isShield(hands.rightHand) && !isShield(hands.leftHand) ? -1 : 1;

const bladeDir = new Vector3(), target = new Vector3(), offTarget = new Vector3();
const up = Vector3.Up(), UNTURNED = Quaternion.Identity();
const wanted = { hand: new Vector3(), holding: new Quaternion(), offHand: new Vector3(), offHolding: new Quaternion() };

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

  const held = weapon && WEAPON_LOOKS[weapon], kind = held?.bow ? null : guardOf(wielder.hands)?.kind ?? null;
  const other = weaponHandIn(wielder.hands) === "leftHand" ? "rightHand" : "leftHand";
  placeHeld(p, ctx, e, model, side, weapon, kind === "dual" ? wielder.hands[other] as WeaponId : null, kind === "shield"
    ? [wielder.hands.rightHand, wielder.hands.leftHand].find(isShield) ?? null : null);
  const facing = wielder.swing?.dir ?? stance.aim;
  p.yaw += wrapAngle(Math.atan2(facing.x, facing.z) - p.yaw) * dampFactor(YAW_RATE, shownDt);
  model.holder.rotation.y = p.yaw;
  const cos = Math.cos(p.yaw), sin = Math.sin(p.yaw), d = stance.actionDir, v = body.vel;
  const way = speed > 0 ? { x: (v.x * cos - v.z * sin) / speed, z: (v.x * sin + v.z * cos) / speed } : { x: 0, z: 1 };
  p.gait += shownDt * 2 * Math.PI * strideOf(speed, Math.abs(way.x)).cyclesPerSec;
  const drawing = alive ? bowDrawOf(world, e) : null;
  moveBow(p.bow, drawing, shownDt);
  const pose = personPose(stance, wielder, MOTIONS[weapon ? WEAPONS[weapon].kind : "sword"], {
    build, side, alive, dodge: { x: d.x * cos - d.z * sin, z: d.x * sin + d.z * cos },
    stagger, deadTime: p.deadTime, time: p.time,
    walk: { phase: p.gait, speed, way },
    landing: p.sinceLanding === null ? 0 : Math.max(0, 1 - p.sinceLanding / LANDING.durationTime),
    ...(held?.bow && drawing && { bow: { ...held.bow, drawn: p.bow.hand, flick: p.bow.flick } }),
    alpha: ctx.battle.blend.alpha, guard: kind, twoHanded: !!held?.twoHanded,
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

  wanted.hand.set(pose.hand.x, pose.hand.y, pose.hand.z);
  holdingOf(pose.blade, pose.edge, wanted.holding);
  wanted.offHand.set(pose.offHand.x, pose.offHand.y, pose.offHand.z);
  if (pose.off) holdingOf(pose.off.blade, pose.off.edge, wanted.offHolding);
  else wanted.offHolding.copyFrom(UNTURNED);
  const shiftTime = shiftTimeOf(p);
  p.held = p.blade?.bow ? null : easeArms(p.held, wanted, { key: heldKey(pose), side, swung: pose.swing && { swing:
    pose.swing.at, set: pose.swing.set }, shiftTime, returnTime: shiftTime, dt: shownDt });
  const arms = p.held ?? wanted, offHeld = p.offBlade && WEAPON_LOOKS[p.offBlade.weapon];
  reachArms(joints, build.look.body, side, arms.hand, arms.holding,
    pose.gripped ? null : { hand: arms.offHand, holding: arms.offHolding, held: offHeld }, alive ? held : null);
  if (p.blade?.bow) pullString(p.blade.bow, p.bow.string, drawing?.nocked ?? false);
  swing(p, joints, shownDt);
}

export const ARM_POLE: Vec3 = { x: 0.5, y: -0.8, z: -0.45 };

export const bladeReach = (held: WeaponLook | null): BladeReach | null => held && !held.bow
  ? { fromM: BLADE_FROM_M, toM: BLADE_FROM_M + held.blade.lengthM, halfM: held.blade.widthM / 2 } : null;

const fromWorld = new Matrix();

// `off` null: the other hand on the grip too.
export function reachArms(
  joints: Joints, body: Look["body"], side: 1 | -1, hand: Vec3, bladeTurn: Quaternion,
  off: { hand: Vec3; holding: Quaternion; held: WeaponLook | null } | null, held: WeaponLook | null,
): void {
  const swordSide = side === 1 ? "R" : "L", offSide = side === 1 ? "L" : "R";
  const pole = (s: 1 | -1) => ({ x: s * ARM_POLE.x, y: ARM_POLE.y, z: ARM_POLE.z });
  reachWith(joints, body, swordSide, target.set(hand.x, hand.y, hand.z), bladeTurn, pole(side), bladeReach(held));
  if (!off) {
    joints.root.getWorldMatrix().invertToRef(fromWorld);
    Vector3.TransformCoordinatesToRef(joints[`hand.${swordSide}`].getAbsolutePosition(), fromWorld, offTarget);
    up.applyRotationQuaternionToRef(bladeTurn, bladeDir);
    offTarget.subtractInPlace(bladeDir.scaleInPlace(OFF_GRIP_M));
    reachWith(joints, body, offSide, offTarget, bladeTurn, pole(-side as 1 | -1));
  } else {
    offTarget.set(off.hand.x, off.hand.y, off.hand.z);
    reachWith(joints, body, offSide, offTarget, off.holding, pole(-side as 1 | -1), bladeReach(off.held));
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

function placeHeld(
  p: PersonDrawing, ctx: ArenaScene, e: Entity, model: PersonModel, side: 1 | -1, weapon: WeaponId | null,
  offWeapon: WeaponId | null, shield: ItemId | null,
): void {
  const grip = (s: 1 | -1) => model.joints[s === 1 ? "grip.R" : "grip.L"], moved = side !== p.bladeSide;
  if (moved || weapon !== (p.blade?.weapon ?? null)) {
    dropBlade(p.blade);
    p.blade = weapon && holdBlade(ctx, e, grip(side), weapon, 0);
  }
  if (moved || offWeapon !== (p.offBlade?.weapon ?? null)) {
    dropBlade(p.offBlade);
    p.offBlade = offWeapon && holdBlade(ctx, e, grip(-side as 1 | -1), offWeapon, 0);
  }
  if (moved || shield !== (p.shield?.item ?? null)) {
    dropShield(p.shield);
    p.shield = shield && holdShield(ctx, grip(-side as 1 | -1), shield);
  }
  p.bladeSide = side;
}
