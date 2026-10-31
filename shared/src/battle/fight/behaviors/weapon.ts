import type { Entity, System, World } from "../../../core/ecs.js";
import { turnToward } from "../../../core/math.js";
import { FIXED_DT, toSteps } from "../../../core/time.js";
import {
  ENEMY_GUARD, GUARD_SIDES, mirrorSide, weaponIn, type AttackKind, type GuardSide, type Weapon,
} from "../../../weapons/weapons.js";
import {
  Enemy, Player, WeaponAttack, Wielder, type EnemyData, type SwingData, type WeaponAttackData,
} from "../../components.js";
import type { FightEvent } from "../context.js";
import { grabbable, inGrabReach, startGrab } from "../weapons/guard-break.js";
import { bladeLive, lastFeintStep, startSwing } from "../weapons/swing.js";
import { enter, roll } from "./common.js";

/** Starts only when facing the target this squarely (cos of the angle). */
export const MIN_FACING_DOT = 0.8;
/** Keeps turning toward the target while winding up, this fast. */
export const WINDUP_TURN_RAD_PER_SEC = 2.5;
export const STEP_ACCEL = 40;

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
  const counters = attack.def.counters;
  attack.feint = attack.next === "heavy" && counters !== undefined && roll(enemy) < counters.feintChance;
  turnGuard(enemy, attack, otherSide(enemy, attack.guard));
}

function swingNow(world: World, e: Entity, enemy: EnemyData, weapon: Weapon, kind: AttackKind, side: GuardSide): void {
  const attack = world.require(e, WeaponAttack);
  startSwing(world, e, weapon, kind, side, attack.chain, { x: Math.sin(enemy.yaw), z: Math.cos(enemy.yaw) });
  const liveUntil = world.require(e, Wielder).swing!.liveUntil;
  // Not `enter`: that would end the swing.
  Object.assign(enemy, { state: "weapon", stateTime: 0, duration: liveUntil * FIXED_DT });
}

function strikeNow(world: World, e: Entity, enemy: EnemyData, weapon: Weapon, kind: AttackKind, side: GuardSide): void {
  const attack = world.require(e, WeaponAttack);
  Object.assign(attack, {
    swingsLeft: 0, chain: 0, feint: false, parryRead: false, riposte: false, guard: side, guardFrom: side,
    guardMoveTime: 0,
  });
  swingNow(world, e, enemy, weapon, kind, side);
}

function incomingHeavy(world: World, enemy: EnemyData): SwingData | null {
  const target = enemy.sense.target, swing = target === null ? null : world.get(target, Wielder)?.swing ?? null;
  const near = enemy.sense.dist < enemy.def.attacks.weapon!.triggerDist && enemy.sense.facingDot > MIN_FACING_DOT;
  return swing && near && swing.attack === "heavy" && swing.step < swing.liveAt ? swing : null;
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

export function weaponAttackSystem(events: FightEvent[]): System {
  return (world, dt) => {
    for (const [e, attack, enemy, wielder] of world.query(WeaponAttack, Enemy, Wielder)) {
      const def = attack.def, sense = enemy.sense, move = enemy.move, swing = wielder.swing, counters = def.counters;
      const weapon = weaponIn(wielder.hands);
      attack.cooldown -= dt;
      holdGuard(enemy, attack, dt);
      const incoming = counters ? incomingHeavy(world, enemy) : null;
      if (counters && incoming?.step === 0) attack.parryRead = roll(enemy) < counters.parryChance;
      switch (enemy.state) {
        case "approach": {
          const target = sense.target;
          const inReach = sense.dist < def.triggerDist && sense.facingDot > MIN_FACING_DOT;
          if (!weapon || !sense.targetAlive || target === null) break;
          if (attack.riposte) {
            strikeNow(world, e, enemy, weapon, "light", attack.guard);
          } else if (counters && incoming && attack.parryRead
            && incoming.liveAt - incoming.step <= toSteps(counters.parryLeadTime)) {
            strikeNow(world, e, enemy, weapon, "heavy", mirrorSide(incoming.side));
          } else if (attack.cooldown <= 0 && inReach) {
            const turtling = counters && world.get(target, Player)?.action === "none"
              && inGrabReach(world, e, target) && grabbable(world, target);
            if (turtling && roll(enemy) < counters.guardBreakChance) {
              enter(world, e, enemy, "guardBreak");
              startGrab(wielder);
              break;
            }
            attack.swingsLeft = def.minChain - 1 + Math.floor(roll(enemy) * (def.maxChain - def.minChain + 1));
            attack.chain = 0;
            windUp(world, e, enemy, attack, def.windup);
          }
          break;
        }
        case "weaponWindup":
          enemy.yaw = turnToward(enemy.yaw, sense.toYaw, WINDUP_TURN_RAD_PER_SEC * dt);
          if (weapon && enemy.stateTime >= enemy.duration) swingNow(world, e, enemy, weapon, attack.next, attack.guard);
          break;
        case "weapon":
          if (swing && attack.feint && swing.step >= lastFeintStep(swing)) {
            attack.feint = false;
            attack.swingsLeft = 0;
            enter(world, e, enemy, "approach");
            attack.cooldown = Math.max(attack.cooldown, def.cooldown);
            events.push({ type: "feint", by: e });
            break;
          }
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
