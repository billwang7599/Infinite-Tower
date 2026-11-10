/**
 * What every enemy does, whatever its attacks: track the target, regain poise, walk up to the target
 * ("approach"), get staggered when poise breaks, sit out "stunned", die. Attack systems run right
 * after this and may take over from "approach". The motor turns the wanted movement into velocity.
 *
 *   approach ──attack system──▶ <attack states> ──▶ approach
 *      ▲  poise breaks (not while armored) ──▶ staggered ──┘   hp 0 ──▶ dead
 */
import type { Entity, System, World } from "../../../core/ecs.js";
import { clamp, distXZ, turnToward, wrapAngle, type Vec3 } from "../../../core/math.js";
import { Body, Enemy, Health, Player, type EnemyData } from "../../components.js";
import { FighterStats, moveSpeed, stunTime, type Stats } from "../../stats.js";
import { enter, stun } from "./common.js";

/** The enemy stops walking this far from the target's center. */
const STOP_DIST = 2.2;
const ACCEL = { normal: 25, stunned: 60, staggered: 30, dead: 15 } as const;
/** States poise breaking doesn't interrupt. */
const UNSTAGGERABLE = new Set(["staggered", "stunned"]);

/** Each foe already on a player counts as this much (m) farther, so a group splits its attention among players. */
const CROWD_PENALTY_M = 3;

/** The nearest player still standing, counting the foes already on each; with none, the nearest of the fallen. */
function targetFor(world: World, self: Entity, from: Vec3): { e: Entity; pos: Vec3; alive: boolean } | null {
  let best: { e: Entity; pos: Vec3; alive: boolean; score: number } | null = null;
  for (const [e, , body, health] of world.query(Player, Body, Health)) {
    const alive = health.hp > health.floor;
    let crowd = 0;
    for (const [o, other] of world.query(Enemy)) if (o !== self && other.sense.target === e) crowd++;
    const score = distXZ(from, body.pos) + (alive ? crowd * CROWD_PENALTY_M : 0);
    if (!best || (alive && !best.alive) || (alive === best.alive && score < best.score)) {
      best = { e, pos: body.pos, alive, score };
    }
  }
  return best;
}

/** Slower near where it stops, and while still turning to face the target; backing away is negative. */
export function approachSpeed(enemy: EnemyData, stats: Stats): number {
  const def = enemy.def, sense = enemy.sense, keep = def.keepAway;
  const speed = moveSpeed(def.walkSpeed, stats) * Math.max(0, sense.facingDot);
  return keep && sense.dist < keep.nearM ? -speed * clamp(keep.nearM - sense.dist, 0, 1)
    : speed * clamp(sense.dist - (keep?.farM ?? STOP_DIST), 0, 1);
}

export function enemyBrainSystem(): System {
  return (world, dt) => {
    // Cleared first: targetFor counts only the foes that have chosen this step.
    for (const [, enemy] of world.query(Enemy)) enemy.sense.target = null;
    for (const [e, enemy, body, health, stats] of world.query(Enemy, Body, Health, FighterStats)) {
      const def = enemy.def;
      enemy.stateTime += dt;
      if (enemy.state !== "staggered") enemy.poise = Math.min(def.poise, enemy.poise + def.poiseRegen * dt);

      if (health.hp <= health.floor) {
        if (enemy.state !== "dead") enter(world, e, enemy, "dead");
      } else if (enemy.poise <= 0 && !enemy.armored && !UNSTAGGERABLE.has(enemy.state)) {
        stun(world, e, enemy, "staggered", stunTime(def.staggerTime, stats));
        enemy.poise = def.poise;
      }
      enemy.armored = false;

      const p = body.pos, sense = enemy.sense;
      sense.dist = Infinity; sense.toYaw = enemy.yaw; sense.targetAlive = false; sense.target = null;
      const target = health.hp > health.floor ? targetFor(world, e, p) : null;
      if (target) {
        sense.target = target.e;
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
        case "approach": {
          if (!sense.targetAlive) break;
          enemy.yaw = turnToward(enemy.yaw, sense.toYaw, def.turnRate * dt);
          move.speed = approachSpeed(enemy, stats);
          break;
        }
        case "stunned":
        case "staggered":
          move.accel = ACCEL[enemy.state];
          if (enemy.stateTime >= enemy.duration) enter(world, e, enemy, "approach");
          break;
        case "dead":
          move.accel = ACCEL[enemy.state];
          break;
      }
    }
  };
}
