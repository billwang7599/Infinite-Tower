import { Color3, Quaternion, Vector3 } from "@babylonjs/core";
import {
  Body, damp, dampFactor, Enemy, Health, weaponItemIn, WEAPONS, Wielder, wrapAngle, type Vec3,
} from "@infinite-tower/shared";
import { poseArm } from "../../battle/arm.js";
import { BLADE_FROM_M, bladeEdge, cueBlade, dropCue, holdingOf, showCue, type BladeCue } from "../../battle/blade.js";
import { fighter } from "../../battle/battle.js";
import { heldSwing, swingHeld, type Swung } from "../../battle/impact.js";
import type { ArenaScene } from "../../battle/scene.js";
import { buildSlash, placeSlash, type Slash } from "../../battle/slash.js";
import {
  MOTIONS, strokeOf, WEAPON_LOOKS, wayCut, type WeaponLook, type WeaponMotion,
} from "../../battle/weapons.js";
import {
  buildKobold, disposeKobold, OFF_GRIP_M, SWORDSMAN_BUILD, type KoboldBuild, type KoboldModel,
} from "./model.js";
import { koboldPose } from "./pose.js";
import { breathOf } from "../shape.js";

const HIT_FLASH_COLOR = new Color3(0.9, 0.9, 0.9);
const HEAD_COUNTER = 0.6;
const TAIL_TRAIL = 0.8;
const IDLE = { breathTime: 2.4, breathScale: 0.03, tailTime: 3.1, tailRad: 0.12 };
const bladeDir = new Vector3(), handTarget = new Vector3(), offTarget = new Vector3(), gripAt = new Vector3();

type KoboldNodes = KoboldModel & {
  ctx: ArenaScene; clock: number; blade: Quaternion; handAt: Vector3 | null; motion: WeaponMotion;
  look: WeaponLook | null; cue: BladeCue | null;
  slash: Slash;
  drawnSwing: Swung | null;
};

export const koboldVisual = (build: KoboldBuild) => fighter<KoboldNodes>("enemy", {
  spawn(ctx, world, e, node) {
    const enemy = world.require(e, Enemy), wielder = world.require(e, Wielder), held = weaponItemIn(wielder.hands);
    const look = held && WEAPON_LOOKS[held];
    const model = buildKobold(ctx, e, node, enemy.def, enemy.yaw, look, wielder.armReachM, build);
    // Empty-handed, its hand still moves like a sword's.
    return {
      ...model, ctx, clock: 0, blade: new Quaternion(), handAt: null,
      motion: MOTIONS[held ? WEAPONS[held].kind : "sword"], look,
      cue: look ? cueBlade(ctx.scene, model.swordArm.hand, look) : null,
      slash: buildSlash(ctx.scene, `${e}`, ctx.materials.slashFx), drawnSwing: null,
    };
  },
  dispose(nodes) {
    dropCue(nodes.cue);
    nodes.slash.mesh.dispose();
    disposeKobold(nodes);
  },
  frame(nodes, world, e, dt) {
    const enemy = world.require(e, Enemy), health = world.require(e, Health), body = world.require(e, Body);
    const speed = Math.hypot(body.vel.x, body.vel.z);
    nodes.visualYaw += wrapAngle(enemy.yaw - nodes.visualYaw) * dampFactor(15, dt);
    nodes.root.rotation.y = nodes.visualYaw;
    nodes.gait += dt * speed * 3;
    const amp = Math.min(0.7, speed * 0.25);
    nodes.legs[0].rotation.x = Math.sin(nodes.gait) * amp;
    nodes.legs[1].rotation.x = -Math.sin(nodes.gait) * amp;

    const swing = world.require(e, Wielder).swing, stop = nodes.ctx.hitStops.get(e);
    const shown = nodes.drawnSwing = heldSwing(stop, swing && { swing, step: swing.step }, nodes.drawnSwing);
    const drawn = shown && { ...shown.swing, step: shown.step }, poseDt = swingHeld(stop) ? 0 : dt;
    const t = enemy.stateTime, k = enemy.duration > 0 ? Math.min(1, t / enemy.duration) : 1;
    const cut = wayCut(drawn?.way ?? "tb", true);
    const state = health.hp <= 0 ? "dead" : drawn && !swing ? "weapon" : enemy.state;
    const pose = koboldPose(state, t, k, cut, nodes.motion,
      drawn ? strokeOf(drawn) : null, nodes.motion.held(wayCut("tb", true)), drawn?.attack === "heavy");
    nodes.hips.rotation.y = damp(nodes.hips.rotation.y, pose.hipTwist, 14, poseDt);
    nodes.chest.rotation.y = damp(nodes.chest.rotation.y, pose.twist, 14, poseDt);
    nodes.chest.rotation.x = damp(nodes.chest.rotation.x, pose.bend, 12, poseDt);
    nodes.head.rotation.y = -nodes.chest.rotation.y * HEAD_COUNTER;
    nodes.clock += dt;
    nodes.tail.rotation.y = -nodes.hips.rotation.y * TAIL_TRAIL + Math.sin(nodes.gait) * amp * 0.4
      + breathOf(nodes.clock, IDLE.tailTime) * IDLE.tailRad;
    const breath = breathOf(nodes.clock, IDLE.breathTime) * IDLE.breathScale;
    nodes.torso.scaling.set(1 + breath, 1, 1 + breath);

    const hand = nodes.swordArm.hand;
    holdingOf(pose.blade, pose.edge, nodes.blade);
    hand.rotationQuaternion ??= nodes.blade.clone();
    Quaternion.SlerpToRef(hand.rotationQuaternion, nodes.blade, pose.bladeExact ? 1 : dampFactor(18, poseDt),
      hand.rotationQuaternion);
    handTarget.set(pose.hand.x, pose.hand.y, pose.hand.z);
    nodes.handAt ??= handTarget.clone();
    Vector3.LerpToRef(nodes.handAt, handTarget, pose.bladeExact ? 1 : dampFactor(20, poseDt), nodes.handAt);
    offTarget.set(pose.offHand.x, pose.offHand.y, pose.offHand.z - Math.sin(nodes.gait) * amp * 0.25);
    reachKobold(nodes, nodes.handAt, offTarget, nodes.look);
    const live = health.hp > 0 ? swing : null;
    if (nodes.cue) showCue(nodes.cue, live);
    nodes.model.rotation.x = damp(nodes.model.rotation.x, pose.lean, 10, poseDt);
    nodes.model.rotation.z = damp(nodes.model.rotation.z, pose.roll, pose.rollRate, poseDt);
    nodes.model.position.y = damp(nodes.model.position.y, pose.yOff, 8, poseDt);

    placeSlash(nodes.slash, nodes.motion.trail(live), nodes.look && bladeEdge(hand, nodes.look), dt);

    nodes.stars.setEnabled(pose.stars);
    if (pose.stars) nodes.stars.rotation.y += dt * 5;

    for (let i = 0; i < nodes.materials.length; i++) {
      nodes.materials[i]!.emissiveColor.copyFrom(health.flash > 0 ? HIT_FLASH_COLOR : nodes.baseEmissive[i]!);
    }
  },
});

export function reachKobold(m: KoboldModel, hand: Vec3, offHand: Vec3, look: WeaponLook | null): void {
  const held = m.swordArm.hand, off = m.offArm;
  poseArm(m.swordArm, hand, look && {
    fromM: BLADE_FROM_M, toM: BLADE_FROM_M + look.blade.lengthM, halfM: look.blade.widthM / 2,
  });
  if (!m.twoHanded || !held.rotationQuaternion) {
    poseArm(off, offHand);
    return;
  }
  Vector3.Up().applyRotationQuaternionToRef(held.rotationQuaternion, bladeDir);
  held.position.subtractToRef(bladeDir.scaleInPlace(OFF_GRIP_M), gripAt);
  off.hand.rotationQuaternion ??= new Quaternion();
  off.hand.rotationQuaternion.copyFrom(held.rotationQuaternion);
  poseArm(off, gripAt);
}

export const koboldSwordsmanVisual = koboldVisual(SWORDSMAN_BUILD);
