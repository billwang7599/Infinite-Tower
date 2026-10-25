/**
 * Gore attack: up close and facing the target, drop the head (wind-up), lunge with a sweeping hit.
 *
 *   approach ─▶ goreWindup ─▶ gore ─▶ goreRecover ─▶ approach
 */
import { Enemy, GoreAttack, turnToward, type System } from "@infinite-tower/shared";
import { addHit, enter } from "./common.js";

export function goreAttackSystem(): System {
  return (world, dt) => {
    for (const [e, gore, enemy] of world.query(GoreAttack, Enemy)) {
      const G = gore.def, s = enemy.sense, m = enemy.move;
      gore.cooldown -= dt;
      switch (enemy.state) {
        case "approach":
          if (s.targetAlive && gore.cooldown <= 0 && s.dist < G.trigger && s.facingDot > 0.8) {
            enter(world, e, enemy, "goreWindup");
          }
          break;
        case "goreWindup":
          enemy.yaw = turnToward(enemy.yaw, s.toYaw, 1.5 * dt);
          if (enemy.stateTime >= G.windup) {
            enter(world, e, enemy, "gore");
            addHit(world, e, enemy, G);
          }
          break;
        case "gore":
          m.speed = G.lunge; m.accel = 80;
          if (enemy.stateTime >= G.active) {
            enter(world, e, enemy, "goreRecover");
            gore.cooldown = G.recover + G.cooldown;
          }
          break;
        case "goreRecover":
          if (enemy.stateTime >= G.recover) enter(world, e, enemy, "approach");
          break;
      }
    }
  };
}
