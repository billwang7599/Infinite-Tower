import { Color3 } from "@babylonjs/core";
import { Body, damp, dampFactor, Enemy, Health, Skilled, wrapAngle } from "@infinite-tower/shared";
import { fighter } from "../../battle/battle.js";
import { buildGoblin, disposeGoblin, type GoblinModel } from "./model.js";
import { goblinPose } from "./pose.js";

const HIT_FLASH_COLOR = new Color3(0.9, 0.9, 0.9);
const ORB_GLOW = new Color3(1.6, 0.55, 0.15);

export const goblinVisual = fighter<GoblinModel>("enemy", {
  spawn(ctx, world, e, node) {
    const enemy = world.require(e, Enemy);
    return buildGoblin(ctx, e, node, enemy.def, enemy.yaw);
  },
  dispose: disposeGoblin,
  frame(nodes, world, e, dt) {
    const enemy = world.require(e, Enemy), health = world.require(e, Health), body = world.require(e, Body);
    const speed = Math.hypot(body.vel.x, body.vel.z);
    nodes.visualYaw += wrapAngle(enemy.yaw - nodes.visualYaw) * dampFactor(15, dt);
    nodes.root.rotation.y = nodes.visualYaw;
    nodes.gait += dt * speed * 4;
    const amp = Math.min(0.7, speed * 0.3);
    nodes.legs[0].rotation.x = Math.sin(nodes.gait) * amp;
    nodes.legs[1].rotation.x = -Math.sin(nodes.gait) * amp;

    const words = world.require(e, Skilled).words.length;
    const pose = goblinPose(health.hp > 0 ? enemy.state : "dead", enemy.stateTime, words);
    nodes.hand.rotation.x = damp(nodes.hand.rotation.x, pose.staffPitch, 18, dt);
    nodes.hand.position.y = damp(nodes.hand.position.y, pose.handY, 14, dt);
    nodes.hand.position.z = damp(nodes.hand.position.z, pose.handZ, 20, dt);
    nodes.model.rotation.x = damp(nodes.model.rotation.x, pose.lean, 10, dt);
    nodes.model.rotation.z = damp(nodes.model.rotation.z, pose.roll, pose.rollRate, dt);
    nodes.model.position.y = damp(nodes.model.position.y, pose.yOff, 8, dt);
    nodes.stars.setEnabled(pose.stars);
    if (pose.stars) nodes.stars.rotation.y += dt * 5;

    for (let i = 0; i < nodes.materials.length; i++) {
      nodes.materials[i]!.emissiveColor.copyFrom(health.flash > 0 ? HIT_FLASH_COLOR : nodes.baseEmissive[i]!);
    }
    if (health.flash <= 0) ORB_GLOW.scaleToRef(pose.glow, nodes.orb.emissiveColor);
  },
});
