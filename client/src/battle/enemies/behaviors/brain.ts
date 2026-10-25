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
/** Velocity change per second toward what the state wants: standing or walking, stunned, staggered, dead. */
const ACCEL = { normal: 25, stunned: 60, staggered: 30, dead: 15 } as const;

export function enemyBrainSystem(): System {
  return (world, dt) => {
    const target = world.first(LocalPlayer, Body, Health);
    for (const [e, enemy, body, health, stats] of world.query(Enemy, Body, Health, FighterStats)) {
      const def = enemy.def;
      enemy.stateTime += dt;
      if (enemy.state !== "staggered") enemy.poise = Math.min(def.poise, enemy.poise + def.poiseRegen * dt);

      if (health.hp <= 0) {
        if (enemy.state !== "dead") enter(world, e, enemy, "dead");
      } else if (enemy.poise <= 0 && !enemy.armored && enemy.state !== "staggered" && enemy.state !== "stunned") {
        enter(world, e, enemy, "staggered", def.staggerTime);
        enemy.poise = def.poise;
      }
      enemy.armored = false;

      const p = body.mesh.position, sense = enemy.sense;
      sense.dist = Infinity; sense.toYaw = enemy.yaw; sense.targetAlive = false;
      if (target) {
        const tp = target[2].mesh.position;
        sense.dist = distXZ(p, tp);
        sense.toYaw = Math.atan2(tp.x - p.x, tp.z - p.z);
        sense.targetAlive = target[3].hp > 0;
      }
      sense.facingDot = Math.cos(wrapAngle(sense.toYaw - enemy.yaw));

      // Default: stand, facing forward. Behaviors below (and attack systems) override.
      const move = enemy.move;
      move.dirX = Math.sin(enemy.yaw); move.dirZ = Math.cos(enemy.yaw);
      move.speed = 0; move.accel = ACCEL.normal; move.halt = false;

      switch (enemy.state) {
        case "approach":
          if (!sense.targetAlive) break;
          enemy.yaw = turnToward(enemy.yaw, sense.toYaw, def.turnRate * dt);
          // Slow down near the target, and while still turning to face it.
          move.speed = moveSpeed(def.walkSpeed, stats)
            * clamp(sense.dist - STOP_DIST, 0, 1) * Math.max(0, sense.facingDot);
          break;
        case "stunned":
        case "staggered":
          move.accel = ACCEL[enemy.state];
          if (enemy.stateTime >= enemy.duration) enter(world, e, enemy, "approach");
          break;
        case "dead":
          move.accel = ACCEL.dead;
          break;
      }
    }
  };
}
