import { Color3 } from "@babylonjs/core";
import { Body, damp, dampFactor, Enemy, Health, PounceAttack, wrapAngle } from "@infinite-tower/shared";
import { fighter } from "../../battle/battle.js";
import { buildWolf, disposeWolf, type WolfModel } from "./model.js";
import { wolfPose } from "./pose.js";
import { breathOf, flickOf } from "../shape.js";

const LEG_PHASE = [0, Math.PI, Math.PI * 0.5, Math.PI * 1.5] as const;
const HIT_FLASH_COLOR = new Color3(0.9, 0.9, 0.9);
const IDLE = { breathTime: 1.4, breathScale: 0.035, earEveryTime: 2.6, earRad: 0.45 };

export const wolfVisual = fighter<WolfModel>("enemy", {
  spawn(ctx, world, e, node) {
    const enemy = world.require(e, Enemy);
    return buildWolf(ctx, e, node, enemy.def, enemy.yaw);
  },
  dispose: disposeWolf,
  frame(nodes, world, e, dt) {
    const enemy = world.require(e, Enemy), health = world.require(e, Health), body = world.require(e, Body);
    nodes.clock += dt;
    const speed = Math.hypot(body.vel.x, body.vel.z);

    nodes.visualYaw += wrapAngle(enemy.yaw - nodes.visualYaw) * dampFactor(18, dt);
    nodes.root.rotation.y = nodes.visualYaw;

    const pose = wolfPose(health.hp > 0 ? enemy.state : "dead", enemy.stateTime, world.get(e, PounceAttack)?.def);
    nodes.gait += dt * speed * 2.6;
    const amp = Math.min(0.8, speed * 0.14);
    for (let i = 0; i < 4; i++) {
      const leg = nodes.legs[i]!, held = pose.legs[i];
      leg.rotation.x = held === null || held === undefined
        ? Math.sin(nodes.gait + LEG_PHASE[i]!) * amp : damp(leg.rotation.x, held, 18, dt);
    }
    const bob = Math.abs(Math.sin(nodes.gait)) * 0.04 * Math.min(1, speed / 3);

    const breath = breathOf(nodes.clock, IDLE.breathTime) * IDLE.breathScale;
    nodes.trunk.scaling.set(1 + breath, 1 + breath, 1);
    nodes.ears.forEach((ear, i) => {
      ear.rotation.x = -IDLE.earRad * flickOf(nodes.clock + i * 1.1, IDLE.earEveryTime);
    });
    nodes.head.rotation.x = damp(nodes.head.rotation.x, pose.headPitch, 14, dt);
    nodes.jaw.rotation.x = damp(nodes.jaw.rotation.x, pose.jaw, 20, dt);
    nodes.tail.rotation.x = damp(nodes.tail.rotation.x, pose.tail + Math.sin(nodes.clock * 3) * 0.08, 8, dt);
    nodes.model.rotation.x = damp(nodes.model.rotation.x, pose.lean, 12, dt);
    nodes.model.rotation.z = damp(nodes.model.rotation.z, pose.roll, pose.rollRate, dt);
    nodes.ground = damp(nodes.ground, -pose.crouch, 10, dt);
    nodes.model.position.set(
      Math.sin(nodes.clock * 70) * pose.tremble, nodes.ground + bob + pose.lift,
      damp(nodes.model.position.z, pose.zOff, 14, dt),
    );

    for (let i = 0; i < nodes.materials.length; i++) {
      nodes.materials[i]!.emissiveColor.copyFrom(health.flash > 0 ? HIT_FLASH_COLOR : nodes.baseEmissive[i]!);
    }
    const { glow } = pose;
    if (glow > 0 && health.flash <= 0) nodes.eyes.emissiveColor.set(1.6 * glow, 1.0 * glow, 0.2 * glow);
  },
});
