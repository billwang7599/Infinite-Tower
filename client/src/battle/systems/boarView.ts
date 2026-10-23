import { Color3, Vector3 } from "@babylonjs/core";
import { Boar, Health, wrapAngle, type System } from "@infinite-tower/shared";
import { Body, BoarView } from "../components.js";

const LEG_PHASE = [0, Math.PI, Math.PI, 0]; // diagonal pairs move together
const WHITE = new Color3(0.9, 0.9, 0.9);

/**
 * Per render frame: procedural animation of the boar from its AI state. Every attack has a distinct,
 * readable wind-up (that's the whole point of a souls-like enemy):
 *   gore:   head drops and the body rocks back, then the tusks sweep up
 *   charge: head down, front hoof scrapes the ground, eyes glow, red line on the ground
 */
export function boarViewSystem(): System {
  const vel = new Vector3();
  let clock = 0;
  const smooth = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

  return (world, dt) => {
    clock += dt;
    for (const [, view, boar, health, body] of world.query(BoarView, Boar, Health, Body)) {
      body.aggregate.body.getLinearVelocityToRef(vel);
      const speed = Math.hypot(vel.x, vel.z);

      view.visualYaw += wrapAngle(boar.yaw - view.visualYaw) * (1 - Math.exp(-15 * dt));
      view.root.rotation.y = view.visualYaw;

      view.gait += dt * speed * 2.2;
      const amp = Math.min(0.75, speed * 0.13);
      view.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(view.gait + LEG_PHASE[i]!) * amp; });
      const bob = Math.abs(Math.sin(view.gait)) * 0.05 * Math.min(1, speed / 3);

      // Pose targets. headPitch > 0 = nose down; lean > 0 = front down.
      let headPitch = 0, lean = 0, roll = 0, tremble = 0, yOff = 0, zOff = 0, glow = 0;
      let rollRate = 12;
      const t = boar.t;
      const G = boar.def.gore, C = boar.def.charge;
      switch (boar.state) {
        case "goreWindup": {
          const k = Math.min(1, t / G.windup);
          headPitch = 0.5 * k; zOff = -0.3 * k; lean = -0.1 * k; tremble = 0.015 * k;
          break;
        }
        case "gore":
          headPitch = -0.7; zOff = 0.25; lean = 0.1;
          break;
        case "goreRecover":
          headPitch = -0.2 * (1 - t / G.recover);
          break;
        case "chargeWindup": {
          const k = Math.min(1, t / C.windup);
          headPitch = 0.4; lean = 0.12; tremble = 0.035 * k; glow = k;
          // Paw the ground with the front right hoof.
          view.legs[1]!.rotation.x = -0.35 + Math.sin(t * 14) * 0.55;
          break;
        }
        case "charge":
          headPitch = 0.35; lean = 0.15; glow = 1;
          break;
        case "chargeRecover":
          headPitch = 0.1; lean = -0.1 * (1 - t / C.recover);
          break;
        case "stunned":
          headPitch = 0.55; roll = Math.sin(t * 5) * 0.12;
          break;
        case "staggered":
          headPitch = -0.45; lean = -0.15; roll = Math.sin(t * 14) * 0.08;
          break;
        case "dead":
          roll = Math.PI / 2; yOff = 0.45; headPitch = 0.3; rollRate = 6;
          for (const leg of view.legs) leg.rotation.x = 0.3;
          break;
      }

      view.head.rotation.x = smooth(view.head.rotation.x, headPitch, 14, dt);
      view.model.rotation.x = smooth(view.model.rotation.x, lean, 10, dt);
      view.model.rotation.z = smooth(view.model.rotation.z, roll, rollRate, dt);
      view.model.position.set(
        Math.sin(clock * 70) * tremble,
        smooth(view.model.position.y - bob, yOff, 8, dt) + bob,
        smooth(view.model.position.z, zOff, 14, dt),
      );

      view.stars.setEnabled(boar.state === "stunned");
      if (boar.state === "stunned") view.stars.rotation.y += dt * 5;

      const telegraphOn = boar.state === "chargeWindup";
      view.telegraph.setEnabled(telegraphOn);
      if (telegraphOn) view.telegraph.visibility = 0.2 + 0.8 * Math.min(1, t / (C.windup - C.lockAt));

      // Hit flash on every material, then the eye glow on top.
      for (const m of view.materials) {
        const base = (m.metadata as { baseEmissive: Color3 }).baseEmissive;
        m.emissiveColor.copyFrom(health.flash > 0 ? WHITE : base);
      }
      if (glow > 0 && health.flash <= 0) view.eyes.emissiveColor.set(2.2 * glow, 0.3 * glow, 0.1 * glow);
    }
  };
}
