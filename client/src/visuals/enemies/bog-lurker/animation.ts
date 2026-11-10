import { Body, damp, dampFactor, Enemy, Health, SlamAttack, wrapAngle } from "@infinite-tower/shared";
import { fighter } from "../../battle/battle.js";
import { buildLurker, disposeLurker, type LurkerModel } from "./model.js";
import { lurkerPose } from "./pose.js";
import { breathOf, easePace, flashMaterials, flashOver } from "../shape.js";

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
    const speed = nodes.pace = easePace(nodes.pace, Math.hypot(body.vel.x, body.vel.z), dt);

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

    flashMaterials(nodes.materials, nodes.baseEmissive, health.flash);
    const { glow } = pose, { eyes } = nodes;
    if (glow > 0) {
      eyes.emissiveColor.set(0.9 * glow, 1.3 * glow, 0.2 * glow);
      flashOver(eyes.emissiveColor, health.flash);
    }
  },
});
