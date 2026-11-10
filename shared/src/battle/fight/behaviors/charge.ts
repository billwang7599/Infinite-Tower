/**
 * Charge attack: from mid range, wind up (tracking the target, then locking the direction: that's
 * the dodge cue), rush in a straight line. Slamming into the arena wall stuns the enemy: the punish
 * window. Can't be staggered mid-charge.
 *
 *   approach ─▶ chargeWindup ─▶ charge ──hits wall──▶ stunned (brain) ─▶ approach
 *                                  └──runs out──▶ chargeRecover ─▶ approach
 */
import type { System } from "../../../core/ecs.js";
import { turnToward } from "../../../core/math.js";
import { Body, ChargeAttack, Enemy } from "../../components.js";
import type { FightContext } from "../context.js";
import { addHitAhead, enter, stun } from "./common.js";
import { mayStart } from "./group.js";

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

export function chargeAttackSystem(ctx: Pick<FightContext, "arena" | "events">): System {
  return (world, dt) => {
    for (const [e, charge, enemy, body] of world.query(ChargeAttack, Enemy, Body)) {
      const def = charge.def, sense = enemy.sense, move = enemy.move;
      charge.cooldown -= dt;
      switch (enemy.state) {
        case "approach": {
          const inRange = sense.dist >= def.minDist && sense.dist <= def.maxDist;
          if (sense.targetAlive && charge.cooldown <= 0 && inRange && sense.facingDot > MIN_FACING_DOT
            && mayStart(world, e, enemy)) {
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
          const p = body.pos, r = Math.hypot(p.x, p.z);
          const outward = r > 0.01 ? (p.x * move.dirX + p.z * move.dirZ) / r : 0;
          if (r > ctx.arena.radius - enemy.def.radius - WALL_MARGIN && outward > MIN_OUTWARD_DOT) {
            stun(world, e, enemy, "stunned", def.stunTime);
            move.speed = 0; move.halt = true;
            ctx.events.push({ type: "slam", enemy: e });
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
