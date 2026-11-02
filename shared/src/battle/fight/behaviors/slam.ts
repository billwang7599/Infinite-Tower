import type { System } from "../../../core/ecs.js";
import { turnToward } from "../../../core/math.js";
import { Enemy, SlamAttack } from "../../components.js";
import type { FightContext } from "../context.js";
import { addHitAhead, enter } from "./common.js";

const MIN_FACING_DOT = 0.8;
const WINDUP_TURN_RAD_PER_SEC = 1.2;

export function slamAttackSystem(ctx: FightContext): System {
  return (world, dt) => {
    for (const [e, slam, enemy] of world.query(SlamAttack, Enemy)) {
      const def = slam.def, sweep = def.sweep, sense = enemy.sense;
      slam.cooldown -= dt;
      switch (enemy.state) {
        case "approach":
          if (!sense.targetAlive || slam.cooldown > 0) break;
          if (sense.dist < sweep.range && sense.facingDot < sweep.belowDot) enter(world, e, enemy, "sweepWindup");
          else if (sense.dist < def.triggerDist && sense.facingDot > MIN_FACING_DOT) {
            enter(world, e, enemy, "slamWindup");
          }
          if (enemy.state !== "approach") enemy.armored = true;
          break;
        case "slamWindup":
          enemy.armored = true;
          if (enemy.stateTime < def.windup - def.lockAt) {
            enemy.yaw = turnToward(enemy.yaw, sense.toYaw, WINDUP_TURN_RAD_PER_SEC * dt);
          }
          if (enemy.stateTime >= def.windup) {
            enter(world, e, enemy, "slam");
            addHitAhead(world, e, enemy, def);
            ctx.events.push({ type: "slam", enemy: e });
          }
          break;
        case "slam":
          enemy.armored = enemy.stateTime < def.active;
          if (!enemy.armored) {
            enter(world, e, enemy, "slamRecover");
            slam.cooldown = def.recover + def.cooldown;
          }
          break;
        case "slamRecover":
          if (enemy.stateTime >= def.recover) enter(world, e, enemy, "approach");
          break;
        case "sweepWindup":
          enemy.armored = true;
          if (enemy.stateTime >= sweep.windup) {
            enter(world, e, enemy, "sweep");
            addHitAhead(world, e, enemy, sweep);
          }
          break;
        case "sweep":
          enemy.armored = enemy.stateTime < sweep.active;
          if (!enemy.armored) {
            enter(world, e, enemy, "sweepRecover");
            slam.cooldown = sweep.recover + def.cooldown;
          }
          break;
        case "sweepRecover":
          if (enemy.stateTime >= sweep.recover) enter(world, e, enemy, "approach");
          break;
      }
    }
  };
}
