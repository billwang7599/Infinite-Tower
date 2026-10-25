/**
 * Lunge attack: up close and facing the target, drop the head (wind-up), lunge with a sweeping hit.
 *
 *   approach ─▶ lungeWindup ─▶ lunge ─▶ lungeRecover ─▶ approach
 */
import { Enemy, LungeAttack, turnToward, type System } from "@infinite-tower/shared";
import { addHitAhead, enter } from "./common.js";

/** Starts only when facing the target this squarely (cos of the angle). */
const MIN_FACING_DOT = 0.8;
/** Still turns toward the target during the wind-up, this fast. */
const WINDUP_TURN_RAD_PER_SEC = 1.5;
/** Velocity change per second while lunging. */
const LUNGE_ACCEL = 80;

export function lungeAttackSystem(): System {
  return (world, dt) => {
    for (const [e, lunge, enemy] of world.query(LungeAttack, Enemy)) {
      const def = lunge.def, sense = enemy.sense, move = enemy.move;
      lunge.cooldown -= dt;
      switch (enemy.state) {
        case "approach":
          const inReach = sense.dist < def.triggerDist && sense.facingDot > MIN_FACING_DOT;
          if (sense.targetAlive && lunge.cooldown <= 0 && inReach) enter(world, e, enemy, "lungeWindup");
          break;
        case "lungeWindup":
          enemy.yaw = turnToward(enemy.yaw, sense.toYaw, WINDUP_TURN_RAD_PER_SEC * dt);
          if (enemy.stateTime >= def.windup) {
            enter(world, e, enemy, "lunge");
            addHitAhead(world, e, enemy, def);
          }
          break;
        case "lunge":
          move.speed = def.speed; move.accel = LUNGE_ACCEL;
          if (enemy.stateTime >= def.active) {
            enter(world, e, enemy, "lungeRecover");
            lunge.cooldown = def.recover + def.cooldown;
          }
          break;
        case "lungeRecover":
          if (enemy.stateTime >= def.recover) enter(world, e, enemy, "approach");
          break;
      }
    }
  };
}
