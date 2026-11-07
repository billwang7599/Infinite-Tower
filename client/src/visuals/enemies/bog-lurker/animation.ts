import { Color3 } from "@babylonjs/core";
import { Body, damp, dampFactor, Enemy, Health, SlamAttack, wrapAngle } from "@infinite-tower/shared";
import { fighter } from "../../battle/battle.js";
import { buildLurker, disposeLurker, type LurkerModel } from "./model.js";
import { lurkerPose } from "./pose.js";
import { breathOf } from "../shape.js";

const HIT_FLASH_COLOR = new Color3(0.9, 0.9, 0.9);
const IDLE = { breathTime: 3.2, breathScale: 0.035 };

export const lurkerVisual = fighter<LurkerModel>("enemy", {
  spawn(ctx, world, e, node) {
    const enemy = world.require(e, Enemy);
    return buildLurker(ctx, e, node, enemy.def, enemy.yaw);
  },
  dispose: disposeLurker,
  frame(nodes, world, e, dt) {
    const enemy = world.require(e, Enemy), health = world.require(e, Health), body = world.require(e, Body);
    nodes.clock += dt;
    const speed = Math.hypot(body.vel.x, body.vel.z);

    nodes.visualYaw += wrapAngle(enemy.yaw - nodes.visualYaw) * dampFactor(10, dt);
    nodes.root.rotation.y = nodes.visualYaw;

    const state = health.hp > 0 ? enemy.state : "dead";
    const pose = lurkerPose(state, enemy.stateTime, world.get(e, SlamAttack)?.def);
    nodes.gait += dt * speed * 2.4;
    const amp = Math.min(0.6, speed * 0.3);
    nodes.arms.forEach((arm, i) => {
      const walk = Math.sin(nodes.gait + i * Math.PI) * amp;
      arm.rotation.x = damp(arm.rotation.x, -pose.arms + walk, 14, dt);
    });

    nodes.spin = state === "sweep" ? pose.spin : damp(wrapAngle(nodes.spin), pose.spin, 12, dt);
    nodes.model.rotation.y = nodes.spin;
    nodes.model.rotation.x = damp(nodes.model.rotation.x, pose.lean, 10, dt);
    nodes.model.rotation.z = damp(nodes.model.rotation.z, pose.roll, 6, dt);
    nodes.head.rotation.x = damp(nodes.head.rotation.x, pose.headPitch, 10, dt);
    nodes.jaw.rotation.x = damp(nodes.jaw.rotation.x, pose.jaw, 14, dt);
    nodes.tail.rotation.y = Math.sin(nodes.clock * 1.6) * 0.25;
    const breath = breathOf(nodes.clock, IDLE.breathTime) * IDLE.breathScale;
    nodes.trunk.scaling.set(1 + breath, 1 + breath * 1.4, 1);
    const bob = Math.sin(nodes.clock * 1.3) * 0.03;
    nodes.model.position.x = Math.sin(nodes.clock * 60) * pose.tremble;
    nodes.model.position.y = damp(nodes.model.position.y, -pose.sink + bob, state === "slam" ? 30 : 6, dt);

    for (let i = 0; i < nodes.materials.length; i++) {
      nodes.materials[i]!.emissiveColor.copyFrom(health.flash > 0 ? HIT_FLASH_COLOR : nodes.baseEmissive[i]!);
    }
    const { glow } = pose;
    if (glow > 0 && health.flash <= 0) nodes.eyes.emissiveColor.set(0.9 * glow, 1.3 * glow, 0.2 * glow);
  },
});
