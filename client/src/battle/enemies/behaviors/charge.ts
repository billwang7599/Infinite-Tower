/**
 * Charge attack: from mid range, wind up (tracking the target, then locking the direction: that's
 * the dodge cue), rush in a straight line. Slamming into the arena wall stuns the enemy: the punish
 * window. Can't be staggered mid-charge.
 *
 *   approach ─▶ chargeWindup ─▶ charge ──hits wall──▶ stunned (brain) ─▶ approach
 *                                  └──runs out──▶ chargeRecover ─▶ approach
 */
import { ChargeAttack, Enemy, turnToward, type System } from "@infinite-tower/shared";
import { Body } from "../../components.js";
import type { BattleContext } from "../../context.js";
import { addHitAhead, enter } from "./common.js";

/** Starts only when facing the target this squarely (cos of the angle). */
const MIN_FACING_DOT = 0.7;
/** Turns toward the target during the wind-up (until it locks), this fast. */
const WINDUP_TURN_RAD_PER_SEC = 4;
/** Velocity change per second: getting up to speed, and skidding to a stop after. */
const CHARGE_ACCEL = 120;
const RECOVER_ACCEL = 20;
/** It hits the wall this far before its body would touch it, if heading outward at least this much (cos). */
const WALL_MARGIN = 0.45;
const MIN_OUTWARD_DOT = 0.3;

export function chargeAttackSystem(ctx: BattleContext): System {
  return (world, dt) => {
    for (const [e, charge, enemy, body] of world.query(ChargeAttack, Enemy, Body)) {
      const def = charge.def, sense = enemy.sense, move = enemy.move;
      charge.cooldown -= dt;
      switch (enemy.state) {
        case "approach": {
          const inRange = sense.dist >= def.minDist && sense.dist <= def.maxDist;
          if (sense.targetAlive && charge.cooldown <= 0 && inRange && sense.facingDot > MIN_FACING_DOT) {
            enter(world, e, enemy, "chargeWindup");
          }
          break;
        }
        case "chargeWindup":
          if (enemy.stateTime < def.windup - def.lockAt) {
            enemy.yaw = turnToward(enemy.yaw, sense.toYaw, WINDUP_TURN_RAD_PER_SEC * dt);
          }
          if (enemy.stateTime >= def.windup) {
            enter(world, e, enemy, "charge");
            charge.dir = { x: Math.sin(enemy.yaw), z: Math.cos(enemy.yaw) };
            addHitAhead(world, e, enemy, def);
          }
          break;
        case "charge": {
          enemy.armored = true;
          move.dirX = charge.dir.x; move.dirZ = charge.dir.z; move.speed = def.speed; move.accel = CHARGE_ACCEL;
          const p = body.mesh.position, r = Math.hypot(p.x, p.z);
          const outward = r > 0.01 ? (p.x * move.dirX + p.z * move.dirZ) / r : 0;
          if (r > ctx.arena.radius - enemy.def.radius - WALL_MARGIN && outward > MIN_OUTWARD_DOT) {
            enter(world, e, enemy, "stunned", def.stunTime);
            charge.cooldown = def.stunTime + def.cooldown;
            move.speed = 0; move.halt = true;
            ctx.shake = Math.max(ctx.shake, 0.35);
          } else if (enemy.stateTime >= def.maxChargeTime) {
            enter(world, e, enemy, "chargeRecover");
            charge.cooldown = def.recover + def.cooldown;
          }
          break;
        }
        case "chargeRecover":
          move.accel = RECOVER_ACCEL;
          if (enemy.stateTime >= def.recover) enter(world, e, enemy, "approach");
          break;
      }
    }
  };
}
