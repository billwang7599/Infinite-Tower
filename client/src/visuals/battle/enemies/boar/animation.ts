import { Color3 } from "@babylonjs/core";
import { Body, ChargeAttack, damp, dampFactor, Enemy, Health, LungeAttack, wrapAngle } from "@infinite-tower/shared";
import { fighter } from "../../battle.js";
import { buildBoar, disposeBoar, type BoarModel } from "./model.js";
import { boarPose } from "./pose.js";

const LEG_PHASE = [0, Math.PI, Math.PI, 0] as const; // diagonal pairs move together
const HIT_FLASH_COLOR = new Color3(0.9, 0.9, 0.9);

export const boarVisual = fighter<BoarModel>("enemy", {
  spawn(ctx, world, e, node) {
    const enemy = world.require(e, Enemy);
    return buildBoar(ctx, e, node, enemy.def, enemy.yaw);
  },
  dispose: disposeBoar,
  frame(nodes, world, e, dt) {
    const enemy = world.require(e, Enemy), health = world.require(e, Health), body = world.require(e, Body);
    nodes.clock += dt;
    const speed = Math.hypot(body.vel.x, body.vel.z);

    nodes.visualYaw += wrapAngle(enemy.yaw - nodes.visualYaw) * dampFactor(15, dt);
    nodes.root.rotation.y = nodes.visualYaw;

    const lunge = world.get(e, LungeAttack)?.def, charge = world.get(e, ChargeAttack)?.def;
    const pose = boarPose(health.hp > 0 ? enemy.state : "dead", enemy.stateTime, lunge, charge);
    nodes.gait += dt * speed * 2.2;
    const amp = Math.min(0.75, speed * 0.13);
    for (let i = 0; i < 4; i++) nodes.legs[i]!.rotation.x = pose.legs[i] ?? Math.sin(nodes.gait + LEG_PHASE[i]!) * amp;
    const bob = Math.abs(Math.sin(nodes.gait)) * 0.05 * Math.min(1, speed / 3);

    nodes.head.rotation.x = damp(nodes.head.rotation.x, pose.headPitch, 14, dt);
    nodes.model.rotation.x = damp(nodes.model.rotation.x, pose.lean, 10, dt);
    nodes.model.rotation.z = damp(nodes.model.rotation.z, pose.roll, pose.rollRate, dt);
    nodes.model.position.set(
      Math.sin(nodes.clock * 70) * pose.tremble,
      damp(nodes.model.position.y - bob, pose.yOff, 8, dt) + bob,
      damp(nodes.model.position.z, pose.zOff, 14, dt),
    );

    nodes.stars.setEnabled(pose.stars);
    if (pose.stars) nodes.stars.rotation.y += dt * 5;
    nodes.telegraph.setEnabled(pose.telegraph !== null);
    if (pose.telegraph !== null) nodes.telegraph.visibility = pose.telegraph;

    // Hit flash on every material, then the eye glow on top.
    for (let i = 0; i < nodes.materials.length; i++) {
      nodes.materials[i]!.emissiveColor.copyFrom(health.flash > 0 ? HIT_FLASH_COLOR : nodes.baseEmissive[i]!);
    }
    const { glow } = pose;
    if (glow > 0 && health.flash <= 0) nodes.eyes.emissiveColor.set(2.2 * glow, 0.3 * glow, 0.1 * glow);
  },
});
