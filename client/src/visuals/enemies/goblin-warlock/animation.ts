import { Color3, Vector3 } from "@babylonjs/core";
import { Body, damp, dampFactor, Enemy, Health, Skilled, wrapAngle } from "@infinite-tower/shared";
import { poseArm } from "../../battle/arm.js";
import { fighter } from "../../battle/battle.js";
import { buildGoblin, disposeGoblin, type GoblinModel } from "./model.js";
import { goblinPose } from "./pose.js";
import { breathOf, easePace, flashMaterials, flashOver, flickOf } from "../shape.js";

const ORB_GLOW = new Color3(1.6, 0.55, 0.15);
export const STAFF_HAND_X = 0.2;
const IDLE = { breathTime: 2.1, breathScale: 0.03, earEveryTime: 2.3, earRad: 0.35, nodTime: 4.2, nodRad: 0.06 };
const offTarget = new Vector3();

export const goblinVisual = fighter<GoblinModel & { handAt: Vector3; offAt: Vector3 | null }>("enemy", {
  spawn(ctx, world, e, node) {
    const enemy = world.require(e, Enemy);
    return { ...buildGoblin(ctx, e, node, enemy.def, enemy.yaw), handAt: new Vector3(STAFF_HAND_X, 0.62, 0.22),
      offAt: null };
  },
  dispose: disposeGoblin,
  frame(nodes, world, e, dt) {
    const enemy = world.require(e, Enemy), health = world.require(e, Health), body = world.require(e, Body);
    const speed = nodes.pace = easePace(nodes.pace, Math.hypot(body.vel.x, body.vel.z), dt);
    nodes.visualYaw += wrapAngle(enemy.yaw - nodes.visualYaw) * dampFactor(15, dt);
    nodes.root.rotation.y = nodes.visualYaw;
    nodes.gait += dt * speed * 4;
    const amp = Math.min(0.7, speed * 0.3);
    nodes.legs[0].rotation.x = Math.sin(nodes.gait) * amp;
    nodes.legs[1].rotation.x = -Math.sin(nodes.gait) * amp;

    const words = world.require(e, Skilled).words.length;
    const pose = goblinPose(health.hp > 0 ? enemy.state : "dead", enemy.stateTime, words);
    const hand = nodes.staffArm.hand;
    hand.rotation.x = damp(hand.rotation.x, pose.staffPitch, 18, dt);
    nodes.handAt.y = damp(nodes.handAt.y, pose.handY, 14, dt);
    nodes.handAt.z = damp(nodes.handAt.z, pose.handZ, 20, dt);
    poseArm(nodes.staffArm, nodes.handAt);
    offTarget.set(pose.offHand.x, pose.offHand.y, pose.offHand.z - Math.sin(nodes.gait) * amp * 0.2);
    nodes.offAt ??= offTarget.clone();
    Vector3.LerpToRef(nodes.offAt, offTarget, dampFactor(10, dt), nodes.offAt);
    poseArm(nodes.offArm, nodes.offAt);
    nodes.model.rotation.x = damp(nodes.model.rotation.x, pose.lean, 10, dt);
    nodes.model.rotation.z = damp(nodes.model.rotation.z, pose.roll, pose.rollRate, dt);
    nodes.model.position.y = damp(nodes.model.position.y, pose.yOff, 8, dt);
    nodes.clock += dt;
    const breath = breathOf(nodes.clock, IDLE.breathTime) * IDLE.breathScale;
    nodes.gown.scaling.set(1 + breath, 1, 1 + breath);
    nodes.head.rotation.x = breathOf(nodes.clock, IDLE.nodTime) * IDLE.nodRad;
    nodes.ears.forEach((ear, i) => {
      ear.rotation.y = (i ? 1 : -1) * IDLE.earRad * flickOf(nodes.clock + i * 0.7, IDLE.earEveryTime);
    });
    nodes.stars.setEnabled(pose.stars);
    if (pose.stars) nodes.stars.rotation.y += dt * 5;

    flashMaterials(nodes.materials, nodes.baseEmissive, health.flash);
    ORB_GLOW.scaleToRef(pose.glow, nodes.orb.emissiveColor);
    flashOver(nodes.orb.emissiveColor, health.flash);
  },
});
