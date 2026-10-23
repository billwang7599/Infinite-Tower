/**
 * What every enemy does, whatever its attacks: track the target, regain poise, walk up to the target
 * ("approach"), get staggered when poise breaks, sit out "stunned", die. Attack systems run right
 * after this and may take over from "approach". Engine-free: the motor applies the result.
 *
 *   approach ──attack system──▶ <attack states> ──▶ approach
 *      ▲  poise breaks (not while armored) ──▶ staggered ──┘   hp 0 ──▶ dead
 */
import {
  clamp, distXZ, Enemy, FighterStats, Health, LocalPlayer, moveSpeed, turnToward, wrapAngle, type System,
} from "@infinite-tower/shared";
import { Body } from "../../components.js";
import { enter } from "./common.js";

/** The enemy stops walking this far from the target's center. */
const STOP_DIST = 2.2;

export function enemyBrainSystem(): System {
  return (world, dt) => {
    const target = world.first(LocalPlayer, Body, Health);
    for (const [e, enemy, body, health, stats] of world.query(Enemy, Body, Health, FighterStats)) {
      const D = enemy.def;
      enemy.t += dt;
      if (enemy.state !== "staggered") enemy.poise = Math.min(D.poise, enemy.poise + D.poiseRegen * dt);

      if (health.hp <= 0) {
        if (enemy.state !== "dead") enter(world, e, enemy, "dead");
      } else if (enemy.poise <= 0 && !enemy.armored && enemy.state !== "staggered" && enemy.state !== "stunned") {
        enter(world, e, enemy, "staggered", D.staggerTime);
        enemy.poise = D.poise;
      }
      enemy.armored = false;

      const p = body.mesh.position, s = enemy.sense;
      s.dist = Infinity; s.toYaw = enemy.yaw; s.preyAlive = false;
      if (target) {
        const tp = target[2].mesh.position;
        s.dist = distXZ(p, tp);
        s.toYaw = Math.atan2(tp.x - p.x, tp.z - p.z);
        s.preyAlive = target[3].hp > 0;
      }
      s.facing = Math.cos(wrapAngle(s.toYaw - enemy.yaw)); // 1 = looking right at the target

      // Default: stand, facing forward. Behaviors below (and attack systems) override.
      const m = enemy.move;
      m.dirX = Math.sin(enemy.yaw); m.dirZ = Math.cos(enemy.yaw); m.speed = 0; m.accel = 25; m.halt = false;

      switch (enemy.state) {
        case "approach":
          if (!s.preyAlive) break;
          enemy.yaw = turnToward(enemy.yaw, s.toYaw, D.turnRate * dt);
          m.speed = moveSpeed(D.walkSpeed, stats) * clamp(s.dist - STOP_DIST, 0, 1) * Math.max(0, s.facing);
          break;
        case "stunned":
        case "staggered":
          m.accel = enemy.state === "stunned" ? 60 : 30;
          if (enemy.t >= enemy.duration) enter(world, e, enemy, "approach");
          break;
        case "dead":
          m.accel = 15;
          break;
      }
    }
  };
}
