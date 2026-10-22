import { Vector3 } from "@babylonjs/core";
import {
  ActiveHit, Boar, Health, LocalPlayer, ARENA, BOAR, type BoarData, type BoarState, type System,
} from "@infinite-tower/shared";
import { Body } from "../components.js";
import type { GameContext } from "../context.js";
import { approach } from "./player.js";

export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function turnToward(current: number, target: number, maxStep: number): number {
  const diff = wrapAngle(target - current);
  return current + Math.max(-maxStep, Math.min(maxStep, diff));
}

/**
 * Boar AI: a small state machine. Runs before each physics step and only writes velocity.
 *
 *   approach ──close & facing──▶ goreWindup ─▶ gore ─▶ goreRecover ─▶ approach
 *      │
 *      └──mid range & cooldown──▶ chargeWindup ─▶ charge ──hits wall──▶ stunned ─▶ approach
 *                                  (tracks you,      │
 *                                   then locks)      └──runs out──▶ chargeRecover ─▶ approach
 *
 * Breaking its poise (several hits in quick succession) staggers it, except mid-charge.
 */
export function boarSystem(ctx: GameContext): System {
  const v = new Vector3();
  const G = BOAR.gore, C = BOAR.charge;

  return (world, dt) => {
    const target = world.first(LocalPlayer, Body, Health);
    for (const [e, boar, body, health] of world.query(Boar, Body, Health)) {
      const b = body.aggregate.body;
      b.getLinearVelocityToRef(v);
      const p = body.mesh.position;

      const enter = (s: BoarState) => {
        boar.state = s;
        boar.t = 0;
        world.remove(e, ActiveHit);
      };

      boar.t += dt;
      boar.chargeCooldown -= dt;
      boar.goreCooldown -= dt;
      if (boar.state !== "staggered") boar.poise = Math.min(BOAR.poise, boar.poise + BOAR.poiseRegen * dt);

      if (health.hp <= 0) {
        if (boar.state !== "dead") enter("dead");
      } else if (boar.poise <= 0 && !["charge", "staggered", "stunned"].includes(boar.state)) {
        enter("staggered");
        boar.poise = BOAR.poise;
      }

      let dist = Infinity, toYaw = boar.yaw, preyAlive = false;
      if (target) {
        const tp = target[2].mesh.position;
        const dx = tp.x - p.x, dz = tp.z - p.z;
        dist = Math.hypot(dx, dz);
        toYaw = Math.atan2(dx, dz);
        preyAlive = target[3].hp > 0;
      }
      const facing = Math.cos(wrapAngle(toYaw - boar.yaw)); // 1 = looking right at the player

      let speed = 0, accel = 25;
      let dirX = Math.sin(boar.yaw), dirZ = Math.cos(boar.yaw);

      switch (boar.state) {
        case "approach": {
          if (!preyAlive) break;
          boar.yaw = turnToward(boar.yaw, toYaw, BOAR.turnRate * dt);
          speed = BOAR.walkSpeed * Math.max(0, Math.min(1, dist - 2.2)) * Math.max(0, facing);
          if (boar.chargeCooldown <= 0 && dist >= C.minDist && dist <= C.maxDist && facing > 0.7) enter("chargeWindup");
          else if (boar.goreCooldown <= 0 && dist < G.trigger && facing > 0.8) enter("goreWindup");
          break;
        }
        case "goreWindup":
          boar.yaw = turnToward(boar.yaw, toYaw, 1.5 * dt);
          if (boar.t >= G.windup) {
            enter("gore");
            addHit(world, e, boar, G.range, G.minDot, G.damage, G.knockback, G.lift);
          }
          break;
        case "gore":
          speed = G.lunge;
          accel = 80;
          if (boar.t >= G.active) enter("goreRecover");
          break;
        case "goreRecover":
          if (boar.t >= G.recover) { enter("approach"); boar.goreCooldown = G.cooldown; }
          break;
        case "chargeWindup":
          // Track the player, then lock the direction just before launching: that's the dodge cue.
          if (boar.t < C.windup - C.lockAt) boar.yaw = turnToward(boar.yaw, toYaw, 4 * dt);
          if (boar.t >= C.windup) {
            enter("charge");
            boar.chargeDir = { x: Math.sin(boar.yaw), z: Math.cos(boar.yaw) };
            addHit(world, e, boar, C.range, C.minDot, C.damage, C.knockback, C.lift);
          }
          break;
        case "charge": {
          dirX = boar.chargeDir.x;
          dirZ = boar.chargeDir.z;
          speed = C.speed;
          accel = 120;
          // Slammed into the arena wall: stunned. This is the punish window.
          const r = Math.hypot(p.x, p.z);
          const outward = r > 0.01 ? (p.x * dirX + p.z * dirZ) / r : 0;
          if (r > ARENA.radius - BOAR.radius - 0.45 && outward > 0.3) {
            enter("stunned");
            v.x = v.z = 0;
            ctx.shake = Math.max(ctx.shake, 0.35);
          } else if (boar.t >= C.maxTime) {
            enter("chargeRecover");
          }
          break;
        }
        case "chargeRecover":
          accel = 20; // skid to a stop
          if (boar.t >= C.recover) { enter("approach"); boar.chargeCooldown = C.cooldown; }
          break;
        case "stunned":
          accel = 60;
          if (boar.t >= C.stun) { enter("approach"); boar.chargeCooldown = C.cooldown; }
          break;
        case "staggered":
          accel = 30;
          if (boar.t >= BOAR.staggerTime) enter("approach");
          break;
        case "dead":
          accel = 15;
          break;
      }

      v.x = approach(v.x, dirX * speed, accel * dt);
      v.z = approach(v.z, dirZ * speed, accel * dt);
      b.setLinearVelocity(v);
    }
  };
}

function addHit(
  world: GameContext["world"], e: number, boar: BoarData,
  range: number, minDot: number, damage: number, knockback: number, lift: number,
): void {
  world.add(e, ActiveHit, {
    dirX: Math.sin(boar.yaw), dirZ: Math.cos(boar.yaw), range, minDot, damage, knockback, lift, poise: 0, hit: new Set(),
  });
}
