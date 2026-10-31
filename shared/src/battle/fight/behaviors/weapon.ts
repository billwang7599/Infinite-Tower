import type { Entity, System, World } from "../../../core/ecs.js";
import { turnToward } from "../../../core/math.js";
import { FIXED_DT } from "../../../core/time.js";
import { ENEMY_GUARD, GUARD_SIDES, weaponIn, type GuardSide } from "../../../weapons/weapons.js";
import { Enemy, WeaponAttack, Wielder, type EnemyData, type WeaponAttackData } from "../../components.js";
import { bladeLive, startSwing } from "../weapons/swing.js";
import { enter, roll } from "./common.js";

/** Starts only when facing the target this squarely (cos of the angle). */
const MIN_FACING_DOT = 0.8;
/** Keeps turning toward the target while winding up, this fast. */
const WINDUP_TURN_RAD_PER_SEC = 2.5;
const STEP_ACCEL = 40;

function otherSide(enemy: EnemyData, from: GuardSide): GuardSide {
  const others = GUARD_SIDES.filter((side) => side !== from);
  return others[Math.floor(roll(enemy) * others.length)]!;
}

export function turnGuard(enemy: EnemyData, attack: WeaponAttackData, side: GuardSide): void {
  if (side === attack.guard) return;
  if (attack.guardMoveTime <= 0) attack.guardFrom = attack.guard;
  attack.guard = side;
  attack.guardMoveTime = ENEMY_GUARD.moveTime;
  attack.guardHoldTime = ENEMY_GUARD.minHoldTime + roll(enemy) * (ENEMY_GUARD.maxHoldTime - ENEMY_GUARD.minHoldTime);
}

function windUp(world: World, e: Entity, enemy: EnemyData, attack: WeaponAttackData, hold: number): void {
  enter(world, e, enemy, "weaponWindup", hold);
  attack.next = roll(enemy) < attack.def.heavyShare ? "heavy" : "light";
  turnGuard(enemy, attack, otherSide(enemy, attack.guard));
}

function holdGuard(enemy: EnemyData, attack: WeaponAttackData, dt: number): void {
  if (enemy.state === "approach") {
    attack.guardHoldTime -= dt;
    if (attack.guardHoldTime <= 0 && attack.guardMoveTime <= 0) {
      turnGuard(enemy, attack, otherSide(enemy, attack.guard));
    }
  }
  attack.guardMoveTime = Math.max(0, attack.guardMoveTime - dt);
  if (attack.guardMoveTime === 0) attack.guardFrom = attack.guard;
}

export function weaponAttackSystem(): System {
  return (world, dt) => {
    for (const [e, attack, enemy, wielder] of world.query(WeaponAttack, Enemy, Wielder)) {
      const def = attack.def, sense = enemy.sense, move = enemy.move, swing = wielder.swing;
      const weapon = weaponIn(wielder.hands);
      attack.cooldown -= dt;
      holdGuard(enemy, attack, dt);
      switch (enemy.state) {
        case "approach": {
          const inReach = sense.dist < def.triggerDist && sense.facingDot > MIN_FACING_DOT;
          if (weapon && sense.targetAlive && attack.cooldown <= 0 && inReach) {
            attack.swingsLeft = def.minChain - 1 + Math.floor(roll(enemy) * (def.maxChain - def.minChain + 1));
            attack.chain = 0;
            windUp(world, e, enemy, attack, def.windup);
          }
          break;
        }
        case "weaponWindup":
          enemy.yaw = turnToward(enemy.yaw, sense.toYaw, WINDUP_TURN_RAD_PER_SEC * dt);
          if (weapon && enemy.stateTime >= enemy.duration) {
            const dir = { x: Math.sin(enemy.yaw), z: Math.cos(enemy.yaw) };
            startSwing(world, e, weapon, attack.next, attack.guard, attack.chain, dir);
            // Not `enter`: that would end the swing.
            Object.assign(enemy, { state: "weapon", stateTime: 0, duration: wielder.swing!.liveUntil * FIXED_DT });
          }
          break;
        case "weapon":
          if (swing && swing.step < swing.liveAt) {
            enemy.yaw = turnToward(enemy.yaw, sense.toYaw, WINDUP_TURN_RAD_PER_SEC * dt);
            swing.dir = { x: Math.sin(enemy.yaw), z: Math.cos(enemy.yaw) };
          }
          if (swing && bladeLive(swing)) { move.speed = def.speed; move.accel = STEP_ACCEL; }
          if (swing && swing.step < swing.liveUntil) break;
          if (weapon && attack.swingsLeft > 0) {
            attack.swingsLeft--;
            attack.chain++;
            windUp(world, e, enemy, attack, def.chainWindup);
          } else {
            // Not `enter`: the blade recovers.
            Object.assign(enemy, { state: "weaponRecover", stateTime: 0, duration: def.recover });
            attack.cooldown = def.recover + def.cooldown;
          }
          break;
        case "weaponRecover":
          if (enemy.stateTime >= def.recover) enter(world, e, enemy, "approach");
          break;
      }
    }
  };
}
