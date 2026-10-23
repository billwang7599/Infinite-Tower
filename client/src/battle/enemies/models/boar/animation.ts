import { Color3, Vector3 } from "@babylonjs/core";
import { ChargeAttack, damp, dampFactor, Enemy, GoreAttack, Health, wrapAngle, type System } from "@infinite-tower/shared";
import { Body } from "../../../components.js";
import { BoarModel } from "./model.js";

const LEG_PHASE = [0, Math.PI, Math.PI, 0]; // diagonal pairs move together
const WHITE = new Color3(0.9, 0.9, 0.9);

/**
 * Per render frame: procedural animation of the boar model from its enemy state. Every attack has a distinct,
 * readable wind-up (that's the whole point of a souls-like enemy):
 *   gore:   head drops and the body rocks back, then the tusks sweep up
 *   charge: head down, front hoof scrapes the ground, eyes glow, red line on the ground
 */
export function boarAnimationSystem(): System {
  const vel = new Vector3();
  let clock = 0;

  return (world, dt) => {
    clock += dt;
    for (const [e, nodes, enemy, health, body] of world.query(BoarModel, Enemy, Health, Body)) {
      body.aggregate.body.getLinearVelocityToRef(vel);
      const speed = Math.hypot(vel.x, vel.z);

      nodes.visualYaw += wrapAngle(enemy.yaw - nodes.visualYaw) * dampFactor(15, dt);
      nodes.root.rotation.y = nodes.visualYaw;

      nodes.gait += dt * speed * 2.2;
      const amp = Math.min(0.75, speed * 0.13);
      nodes.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(nodes.gait + LEG_PHASE[i]!) * amp; });
      const bob = Math.abs(Math.sin(nodes.gait)) * 0.05 * Math.min(1, speed / 3);

      // Pose targets. headPitch > 0 = nose down; lean > 0 = front down.
      let headPitch = 0, lean = 0, roll = 0, tremble = 0, yOff = 0, zOff = 0, glow = 0;
      let rollRate = 12;
      const t = enemy.t;
      const G = world.get(e, GoreAttack)?.def, C = world.get(e, ChargeAttack)?.def;
      switch (enemy.state) {
        case "goreWindup": {
          const k = G ? Math.min(1, t / G.windup) : 1;
          headPitch = 0.5 * k; zOff = -0.3 * k; lean = -0.1 * k; tremble = 0.015 * k;
          break;
        }
        case "gore":
          headPitch = -0.7; zOff = 0.25; lean = 0.1;
          break;
        case "goreRecover":
          headPitch = G ? -0.2 * (1 - t / G.recover) : 0;
          break;
        case "chargeWindup": {
          const k = C ? Math.min(1, t / C.windup) : 1;
          headPitch = 0.4; lean = 0.12; tremble = 0.035 * k; glow = k;
          // Paw the ground with the front right hoof.
          nodes.legs[1]!.rotation.x = -0.35 + Math.sin(t * 14) * 0.55;
          break;
        }
        case "charge":
          headPitch = 0.35; lean = 0.15; glow = 1;
          break;
        case "chargeRecover":
          headPitch = 0.1; lean = C ? -0.1 * (1 - t / C.recover) : 0;
          break;
        case "stunned":
          headPitch = 0.55; roll = Math.sin(t * 5) * 0.12;
          break;
        case "staggered":
          headPitch = -0.45; lean = -0.15; roll = Math.sin(t * 14) * 0.08;
          break;
        case "dead":
          roll = Math.PI / 2; yOff = 0.45; headPitch = 0.3; rollRate = 6;
          for (const leg of nodes.legs) leg.rotation.x = 0.3;
          break;
      }

      nodes.head.rotation.x = damp(nodes.head.rotation.x, headPitch, 14, dt);
      nodes.model.rotation.x = damp(nodes.model.rotation.x, lean, 10, dt);
      nodes.model.rotation.z = damp(nodes.model.rotation.z, roll, rollRate, dt);
      nodes.model.position.set(
        Math.sin(clock * 70) * tremble,
        damp(nodes.model.position.y - bob, yOff, 8, dt) + bob,
        damp(nodes.model.position.z, zOff, 14, dt),
      );

      nodes.stars.setEnabled(enemy.state === "stunned");
      if (enemy.state === "stunned") nodes.stars.rotation.y += dt * 5;

      const telegraphOn = enemy.state === "chargeWindup";
      nodes.telegraph.setEnabled(telegraphOn);
      if (telegraphOn && C) nodes.telegraph.visibility = 0.2 + 0.8 * Math.min(1, t / (C.windup - C.lockAt));

      // Hit flash on every material, then the eye glow on top.
      for (const m of nodes.materials) {
        const base = (m.metadata as { baseEmissive: Color3 }).baseEmissive;
        m.emissiveColor.copyFrom(health.flash > 0 ? WHITE : base);
      }
      if (glow > 0 && health.flash <= 0) nodes.eyes.emissiveColor.set(2.2 * glow, 0.3 * glow, 0.1 * glow);
    }
  };
}
