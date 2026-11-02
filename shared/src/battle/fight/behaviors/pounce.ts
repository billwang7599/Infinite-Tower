/** approach (circling) ─▶ pounceWindup ─▶ pounce ─▶ pounceRecover ─▶ pounceHop ─▶ approach */
import type { System } from "../../../core/ecs.js";
import { clamp, turnToward } from "../../../core/math.js";
import { ActiveHit, Enemy, PounceAttack, type EnemyData, type PounceAttackData } from "../../components.js";
import { FighterStats, moveSpeed } from "../../stats.js";
import { addHitAhead, enter, roll } from "./common.js";

const MIN_FACING_DOT = 0.9;
const WINDUP_TURN_RAD_PER_SEC = 5;
// Off its distance by this much (m) or more, it closes in or backs off at full walking speed.
const CIRCLE_BAND_M = 1;
const LEAP_ACCEL = 120;
const RECOVER_ACCEL = 30;
const HOP_ACCEL = 90;

export function circleAgain(pounce: PounceAttackData, enemy: EnemyData, least: number): void {
  pounce.cooldown = least + roll(enemy) * pounce.def.cooldownSpread;
  pounce.side = roll(enemy) < 0.5 ? 1 : -1;
}

export function pounceAttackSystem(): System {
  return (world, dt) => {
    for (const [e, pounce, enemy, stats] of world.query(PounceAttack, Enemy, FighterStats)) {
      const def = pounce.def, sense = enemy.sense, move = enemy.move;
      switch (enemy.state) {
        case "approach": {
          if (!sense.targetAlive) break;
          pounce.cooldown -= dt;
          const toX = Math.sin(sense.toYaw), toZ = Math.cos(sense.toYaw);
          const inward = clamp((sense.dist - def.circleM) / CIRCLE_BAND_M, -1, 1) * moveSpeed(enemy.def.walkSpeed, stats);
          const round = moveSpeed(def.circleSpeed, stats) * pounce.side;
          const vx = toX * inward + toZ * round, vz = toZ * inward - toX * round, speed = Math.hypot(vx, vz);
          if (speed > 0) Object.assign(move, { dirX: vx / speed, dirZ: vz / speed, speed });
          if (pounce.cooldown <= 0 && sense.dist < def.leapFromM && sense.facingDot > MIN_FACING_DOT) {
            enter(world, e, enemy, "pounceWindup");
            enemy.armored = true;
          }
          break;
        }
        case "pounceWindup":
          enemy.armored = true;
          if (enemy.stateTime < def.windup - def.lockAt) {
            enemy.yaw = turnToward(enemy.yaw, sense.toYaw, WINDUP_TURN_RAD_PER_SEC * dt);
          }
          if (enemy.stateTime >= def.windup) {
            enter(world, e, enemy, "pounce");
            pounce.dir = { x: Math.sin(enemy.yaw), z: Math.cos(enemy.yaw) };
            addHitAhead(world, e, enemy, def);
          }
          break;
        case "pounce":
          enemy.armored = true;
          Object.assign(move, { dirX: pounce.dir.x, dirZ: pounce.dir.z, speed: def.speed, accel: LEAP_ACCEL });
          if (enemy.stateTime >= def.active) {
            const met = (world.get(e, ActiveHit)?.alreadyHit.size ?? 0) > 0;
            enter(world, e, enemy, "pounceRecover", met ? def.recover : def.missRecover);
          }
          break;
        case "pounceRecover":
          move.accel = RECOVER_ACCEL;
          if (enemy.stateTime >= enemy.duration) {
            enter(world, e, enemy, "pounceHop");
            pounce.dir = { x: -Math.sin(sense.toYaw), z: -Math.cos(sense.toYaw) };
          }
          break;
        case "pounceHop":
          Object.assign(move, { dirX: pounce.dir.x, dirZ: pounce.dir.z, speed: def.hopSpeed, accel: HOP_ACCEL });
          if (enemy.stateTime >= def.hopTime) {
            enter(world, e, enemy, "approach");
            circleAgain(pounce, enemy, def.cooldown);
          }
          break;
      }
    }
  };
}
