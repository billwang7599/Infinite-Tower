import { Color3, Quaternion, Vector3 } from "@babylonjs/core";
import {
  Body, Cuts, damp, dampFactor, Enemy, ENEMY_GUARD, Health, OneStrike, Posture, WeaponAttack, weaponIn, weaponItemIn,
  WEAPONS, Wielder, wrapAngle, type WeaponAttackData,
} from "@infinite-tower/shared";
import { poseArm } from "../../battle/arm.js";
import { fighter } from "../../battle/battle.js";
import { guardBlade } from "../../battle/cuts.js";
import { strikeBlade } from "../../battle/lines.js";
import {
  cutOf, lerpBlade, MOTIONS, POSTURE_GUARD_BLADE, REST_BLADE, strokeOf, swingCut, WEAPON_LOOKS, type BladePose,
  type WeaponMotion,
} from "../../battle/weapons.js";
import {
  buildKobold, disposeKobold, OFF_GRIP_M, SWORDSMAN_BUILD, type KoboldBuild, type KoboldModel,
} from "./model.js";
import { koboldPose } from "./pose.js";

const HIT_FLASH_COLOR = new Color3(0.9, 0.9, 0.9);
const HEAD_COUNTER = 0.6;
const TAIL_TRAIL = 0.8;
const bladeDir = new Vector3(), handTarget = new Vector3(), offTarget = new Vector3();

type KoboldNodes = KoboldModel & { blade: Quaternion; handAt: Vector3 | null; motion: WeaponMotion };

export const koboldVisual = (build: KoboldBuild) => fighter<KoboldNodes>("enemy", {
  spawn(ctx, world, e, node) {
    const enemy = world.require(e, Enemy), wielder = world.require(e, Wielder), held = weaponItemIn(wielder.hands);
    const model = buildKobold(ctx, e, node, enemy.def, enemy.yaw, held && WEAPON_LOOKS[held], wielder.armReachM,
      build);
    // Empty-handed, its hand still moves like a sword's.
    return { ...model, blade: new Quaternion(), handAt: null, motion: MOTIONS[held ? WEAPONS[held].kind : "sword"] };
  },
  dispose: disposeKobold,
  frame(nodes, world, e, dt) {
    const enemy = world.require(e, Enemy), health = world.require(e, Health), body = world.require(e, Body);
    const speed = Math.hypot(body.vel.x, body.vel.z);
    nodes.visualYaw += wrapAngle(enemy.yaw - nodes.visualYaw) * dampFactor(15, dt);
    nodes.root.rotation.y = nodes.visualYaw;
    nodes.gait += dt * speed * 3;
    const amp = Math.min(0.7, speed * 0.25);
    nodes.legs[0].rotation.x = Math.sin(nodes.gait) * amp;
    nodes.legs[1].rotation.x = -Math.sin(nodes.gait) * amp;

    const { swing, hands } = world.require(e, Wielder), guard = world.get(e, WeaponAttack);
    const lines = world.get(e, OneStrike), held = lines && strikeBlade(lines, swing, weaponIn(hands)?.heft ?? 1);
    for (const mesh of nodes.sword) mesh.setEnabled(!lines?.loose);
    const t = enemy.stateTime, k = enemy.duration > 0 ? Math.min(1, t / enemy.duration) : 1;
    const cut = swing ? swingCut(swing, true) : cutOf("light", guard?.guard ?? "top", true);
    const heavy = (swing?.attack ?? (enemy.state === "weaponWindup" ? guard?.next : null)) === "heavy";
    const cuts = world.get(e, Cuts);
    const guarding = held ?? (cuts ? guardBlade(cuts)
      : world.has(e, Posture) ? POSTURE_GUARD : heldGuard(nodes.motion, guard));
    const pose = koboldPose(health.hp > 0 ? enemy.state : "dead", t, k, cut, nodes.motion,
      swing && !lines ? strokeOf(swing) : null, guarding, heavy);
    if (held?.exact) pose.bladeExact = true;
    nodes.hips.rotation.y = damp(nodes.hips.rotation.y, pose.hipTwist, 14, dt);
    nodes.chest.rotation.y = damp(nodes.chest.rotation.y, pose.twist, 14, dt);
    nodes.chest.rotation.x = damp(nodes.chest.rotation.x, pose.bend, 12, dt);
    nodes.head.rotation.y = -nodes.chest.rotation.y * HEAD_COUNTER;
    nodes.tail.rotation.y = -nodes.hips.rotation.y * TAIL_TRAIL + Math.sin(nodes.gait) * amp * 0.4;

    const hand = nodes.swordArm.hand;
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), bladeDir.set(pose.blade.x, pose.blade.y, pose.blade.z), nodes.blade);
    hand.rotationQuaternion ??= nodes.blade.clone();
    Quaternion.SlerpToRef(hand.rotationQuaternion, nodes.blade, pose.bladeExact ? 1 : dampFactor(18, dt),
      hand.rotationQuaternion);
    handTarget.set(pose.hand.x, pose.hand.y, pose.hand.z);
    nodes.handAt ??= handTarget.clone();
    Vector3.LerpToRef(nodes.handAt, handTarget, pose.bladeExact ? 1 : dampFactor(20, dt), nodes.handAt);
    poseArm(nodes.swordArm, nodes.handAt);

    const off = nodes.offArm;
    if (nodes.twoHanded && enemy.state !== "guardBreak") {
      Vector3.Up().applyRotationQuaternionToRef(hand.rotationQuaternion, bladeDir);
      hand.position.subtractToRef(bladeDir.scaleInPlace(OFF_GRIP_M), offTarget);
      off.hand.rotationQuaternion ??= new Quaternion();
      off.hand.rotationQuaternion.copyFrom(hand.rotationQuaternion);
    } else {
      offTarget.set(pose.offHand.x, pose.offHand.y, pose.offHand.z - Math.sin(nodes.gait) * amp * 0.25);
    }
    poseArm(off, offTarget);
    nodes.model.rotation.x = damp(nodes.model.rotation.x, pose.lean, 10, dt);
    nodes.model.rotation.z = damp(nodes.model.rotation.z, pose.roll, pose.rollRate, dt);
    nodes.model.position.y = damp(nodes.model.position.y, pose.yOff, 8, dt);

    nodes.stars.setEnabled(pose.stars);
    if (pose.stars) nodes.stars.rotation.y += dt * 5;

    for (let i = 0; i < nodes.materials.length; i++) {
      nodes.materials[i]!.emissiveColor.copyFrom(health.flash > 0 ? HIT_FLASH_COLOR : nodes.baseEmissive[i]!);
    }
  },
});

const POSTURE_GUARD: BladePose = { blade: POSTURE_GUARD_BLADE, handZ: REST_BLADE.handZ };

function heldGuard(motion: WeaponMotion, guard: WeaponAttackData | undefined): BladePose {
  const to = motion.held(cutOf("light", guard?.guard ?? "top", true));
  if (!guard || guard.guardMoveTime <= 0) return to;
  const from = motion.held(cutOf("light", guard.guardFrom, true));
  return { ...to, blade: lerpBlade(from.blade, to.blade, 1 - guard.guardMoveTime / ENEMY_GUARD.moveTime) };
}

export const koboldSwordsmanVisual = koboldVisual(SWORDSMAN_BUILD);
