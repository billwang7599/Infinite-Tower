/**
 * What every enemy does, whatever its attacks: track the target, regain poise, walk up to the target
 * ("approach"), get staggered when poise breaks, sit out "stunned" or "parried", die. Attack systems run right
 * after this and may take over from "approach". The motor turns the wanted movement into velocity.
 *
 *   approach ──attack system──▶ <attack states> ──▶ approach
 *      ▲  poise breaks (not while armored) ──▶ staggered ──┘   hp 0 ──▶ dead
 */
import type { System, World } from "../../../core/ecs.js";
import { clamp, distXZ, turnToward, wrapAngle, type Vec3 } from "../../../core/math.js";
import { Body, Enemy, Health, Player } from "../../components.js";
import { FighterStats, moveSpeed } from "../../stats.js";
import { PARRY } from "../../../weapons/weapons.js";
import { enter } from "./common.js";

/** The enemy stops walking this far from the target's center. */
const STOP_DIST = 2.2;
/** Velocity change per second toward what the state wants: standing or walking, stunned, staggered, dead. */
const ACCEL = { normal: 25, stunned: 60, parried: PARRY.slideDecel, staggered: 30, dead: 15 } as const;
/** States poise breaking doesn't interrupt. */
const UNSTAGGERABLE = new Set(["staggered", "stunned", "parried"]);

/** The nearest player still standing; with none, the nearest of the fallen. */
function targetFor(world: World, from: Vec3): { pos: Vec3; alive: boolean } | null {
  let best: { pos: Vec3; alive: boolean; dist: number } | null = null;
  for (const [, , body, health] of world.query(Player, Body, Health)) {
    const alive = health.hp > 0, dist = distXZ(from, body.pos);
    if (!best || (alive && !best.alive) || (alive === best.alive && dist < best.dist)) {
      best = { pos: body.pos, alive, dist };
    }
  }
  return best;
}

export function enemyBrainSystem(): System {
  return (world, dt) => {
    for (const [e, enemy, body, health, stats] of world.query(Enemy, Body, Health, FighterStats)) {
      const def = enemy.def;
      enemy.stateTime += dt;
      if (enemy.state !== "staggered") enemy.poise = Math.min(def.poise, enemy.poise + def.poiseRegen * dt);

      if (health.hp <= 0) {
        if (enemy.state !== "dead") enter(world, e, enemy, "dead");
      } else if (enemy.poise <= 0 && !enemy.armored && !UNSTAGGERABLE.has(enemy.state)) {
        enter(world, e, enemy, "staggered", def.staggerTime);
        enemy.poise = def.poise;
      }
      enemy.armored = false;

      const p = body.pos, sense = enemy.sense;
      sense.dist = Infinity; sense.toYaw = enemy.yaw; sense.targetAlive = false;
      const target = targetFor(world, p);
      if (target) {
        sense.dist = distXZ(p, target.pos);
        sense.toYaw = Math.atan2(target.pos.x - p.x, target.pos.z - p.z);
        sense.targetAlive = target.alive;
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
        case "parried":
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
