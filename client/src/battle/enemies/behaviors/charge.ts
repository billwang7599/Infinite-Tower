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
import { addHit, enter } from "./common.js";

export function chargeAttackSystem(ctx: BattleContext): System {
  return (world, dt) => {
    for (const [e, charge, enemy, body] of world.query(ChargeAttack, Enemy, Body)) {
      const C = charge.def, s = enemy.sense, m = enemy.move;
      charge.cooldown -= dt;
      switch (enemy.state) {
        case "approach":
          const inRange = s.dist >= C.minDist && s.dist <= C.maxDist;
          if (s.targetAlive && charge.cooldown <= 0 && inRange && s.facingDot > 0.7) {
            enter(world, e, enemy, "chargeWindup");
          }
          break;
        case "chargeWindup":
          if (enemy.stateTime < C.windup - C.lockAt) enemy.yaw = turnToward(enemy.yaw, s.toYaw, 4 * dt);
          if (enemy.stateTime >= C.windup) {
            enter(world, e, enemy, "charge");
            charge.dir = { x: Math.sin(enemy.yaw), z: Math.cos(enemy.yaw) };
            addHit(world, e, enemy, C);
          }
          break;
        case "charge": {
          enemy.armored = true;
          m.dirX = charge.dir.x; m.dirZ = charge.dir.z; m.speed = C.speed; m.accel = 120;
          const p = body.mesh.position, r = Math.hypot(p.x, p.z);
          const outward = r > 0.01 ? (p.x * m.dirX + p.z * m.dirZ) / r : 0;
          if (r > ctx.arena.radius - enemy.def.radius - 0.45 && outward > 0.3) {
            enter(world, e, enemy, "stunned", C.stun);
            charge.cooldown = C.stun + C.cooldown;
            m.speed = 0; m.halt = true;
            ctx.shake = Math.max(ctx.shake, 0.35);
          } else if (enemy.stateTime >= C.maxTime) {
            enter(world, e, enemy, "chargeRecover");
            charge.cooldown = C.recover + C.cooldown;
          }
          break;
        }
        case "chargeRecover":
          m.accel = 20; // skid to a stop
          if (enemy.stateTime >= C.recover) enter(world, e, enemy, "approach");
          break;
      }
    }
  };
}
