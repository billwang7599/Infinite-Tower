/**
 * Sword attack (the Kobold Swordsman): close up and facing the target, a chain of swings or stabs picked by the
 * fight's seeded generator, so both sides pick the same (SwordDef says the rest). Parrying and blocking on guard
 * are in combat.ts.
 *
 *   approach ─▶ swordWindup ─▶ sword ─┬─▶ swordWindup (the chain goes on)
 *                                     └─▶ swordRecover ─▶ approach
 */
import type { System } from "../../../core/ecs.js";
import { nextRandom, turnToward } from "../../../core/math.js";
import { Enemy, SwordAttack, type SwordAttackData } from "../../components.js";
import { attackShape, type AttackKind } from "../../sword.js";
import { addHit } from "../combat.js";
import { enter } from "./common.js";

/** Starts only when facing the target this squarely (cos of the angle). */
const MIN_FACING_DOT = 0.8;
/** Keeps turning toward the target while winding up, this fast. */
const WINDUP_TURN_RAD_PER_SEC = 2.5;
/** Velocity change per second as it steps into a swing. */
const STEP_ACCEL = 40;

/** 0..1. */
function roll(sword: SwordAttackData): number {
  const [value, next] = nextRandom(sword.rng);
  sword.rng = next;
  return value;
}

/** One of its moves at random, not `last` (unless it has no other). */
function pick(sword: SwordAttackData, last: AttackKind | null): AttackKind {
  const others = sword.def.moves.filter((m) => m !== last);
  const options = others.length > 0 ? others : sword.def.moves;
  return options[Math.floor(roll(sword) * options.length)]!;
}

export function swordAttackSystem(): System {
  return (world, dt) => {
    for (const [e, sword, enemy] of world.query(SwordAttack, Enemy)) {
      const def = sword.def, sense = enemy.sense, move = enemy.move;
      sword.cooldown -= dt;
      sword.parryCooldown = Math.max(0, sword.parryCooldown - dt);
      switch (enemy.state) {
        case "approach": {
          const inReach = sense.dist < def.triggerDist && sense.facingDot > MIN_FACING_DOT;
          if (sense.targetAlive && sword.cooldown <= 0 && inReach) {
            sword.swingsLeft = def.minChain - 1 + Math.floor(roll(sword) * (def.maxChain - def.minChain + 1));
            sword.attack = pick(sword, null);
            enter(world, e, enemy, "swordWindup", def.windup);
          }
          break;
        }
        case "swordWindup":
          enemy.yaw = turnToward(enemy.yaw, sense.toYaw, WINDUP_TURN_RAD_PER_SEC * dt);
          if (enemy.stateTime >= enemy.duration) {
            enter(world, e, enemy, "sword", def.active);
            addHit(world, e, Math.sin(enemy.yaw), Math.cos(enemy.yaw), {
              ...attackShape(sword.attack, def), damage: def.damage, knockback: def.knockback, lift: def.lift,
              attack: sword.attack,
            });
          }
          break;
        case "sword":
          move.speed = def.speed; move.accel = STEP_ACCEL;
          if (enemy.stateTime < def.active) break;
          if (sword.swingsLeft > 0) {
            sword.swingsLeft--;
            sword.attack = pick(sword, sword.attack);
            enter(world, e, enemy, "swordWindup", def.chainWindup);
          } else {
            enter(world, e, enemy, "swordRecover", def.recover);
            sword.cooldown = def.recover + def.cooldown;
          }
          break;
        case "swordRecover":
          if (enemy.stateTime >= def.recover) enter(world, e, enemy, "approach");
          break;
      }
    }
  };
}
