import type { Entity, System, World } from "../../../../core/ecs.js";
import { turnToward } from "../../../../core/math.js";
import { FIXED_DT } from "../../../../core/time.js";
import { moveOf, POSTURE, POSTURE_MOVES, type PerilousEnd } from "../../../../weapons/posture.js";
import { GUARD_BREAK, weaponIn, type Weapon } from "../../../../weapons/weapons.js";
import {
  Body, Enemy, Fighter, Health, Player, Posture, Sidestep, WeaponAttack, Wielder, type EnemyData,
  type WeaponAttackData,
} from "../../../components.js";
import { FighterStats, moveSpeed, physicalDamage } from "../../../stats.js";
import { MIN_FACING_DOT, STEP_ACCEL, WINDUP_TURN_RAD_PER_SEC } from "../../behaviors/weapon.js";
import { enter, roll } from "../../behaviors/common.js";
import { HIT_FLASH_TIME, inIframes, stagger } from "../../combat.js";
import type { FightEvent } from "../../context.js";
import { hurt } from "../../skills/statuses.js";
import { nearestInReach } from "../../weapons/guard-break.js";
import { bladeLive, startPostureSwing } from "../../weapons/swing.js";
import { addPosture } from "./posture.js";

const facing = (enemy: EnemyData) => ({ x: Math.sin(enemy.yaw), z: Math.cos(enemy.yaw) });

function pickEnd(enemy: EnemyData, attack: WeaponAttackData): PerilousEnd | null {
  const { perilousChance, ends } = attack.def.posture;
  if (roll(enemy) >= perilousChance) return null;
  const r = roll(enemy);
  return r < ends.thrust ? "thrust" : r < ends.thrust + ends.sweep ? "sweep" : "grab";
}

function windUp(world: World, e: Entity, enemy: EnemyData, attack: WeaponAttackData, weapon: Weapon): void {
  const def = attack.def.posture, move = moveOf(attack.chain);
  const windup = attack.chain === 0 || move === "finisher" ? def.windupTime : def.chainWindupTime;
  const delay = roll(enemy) < def.delayChance ? def.delayTime : 0;
  startPostureSwing(world, e, weapon, move, attack.chain, facing(enemy), windup, delay);
  windingUp(world, e, enemy);
}

// Not `enter`: that would end the swing.
function windingUp(world: World, e: Entity, enemy: EnemyData): void {
  const liveAt = world.require(e, Wielder).swing!.liveAt;
  Object.assign(enemy, { state: "weaponWindup", stateTime: 0, duration: liveAt * FIXED_DT });
}

function next(world: World, e: Entity, enemy: EnemyData, attack: WeaponAttackData, weapon: Weapon): void {
  const end = attack.perilousEnd;
  if (attack.swingsLeft > 0) {
    attack.swingsLeft--;
    attack.chain++;
    windUp(world, e, enemy, attack, weapon);
  } else if (end === "grab") {
    attack.perilousEnd = null;
    enter(world, e, enemy, "guardBreak");
  } else if (end) {
    attack.perilousEnd = null;
    startPostureSwing(world, e, weapon, end, 0, facing(enemy), POSTURE_MOVES[end].windupTime);
    windingUp(world, e, enemy);
  } else recover(enemy, attack, attack.def.posture.recoverTime);
}

// Not `enter`: the blade recovers.
function recover(enemy: EnemyData, attack: WeaponAttackData, time: number): void {
  Object.assign(enemy, { state: "weaponRecover", stateTime: 0, duration: time });
  attack.cooldown = time + attack.def.cooldown;
}

function readTheirs(world: World, e: Entity, enemy: EnemyData, attack: WeaponAttackData, target: Entity): void {
  const theirs = world.get(target, Wielder)?.swing, def = attack.def.posture;
  if (theirs?.step !== 0 || enemy.sense.dist >= attack.def.triggerDist || enemy.sense.facingDot <= MIN_FACING_DOT) {
    return;
  }
  if (theirs.perilous !== "sweep") {
    attack.parryRead = roll(enemy) < (theirs.perilous === "thrust" ? def.thrustDeflectChance : def.deflectChance);
    return;
  }
  attack.parryRead = false;
  const step = world.get(e, Sidestep);
  if (!step || enemy.state !== "approach" || roll(enemy) >= def.sweepStepBackChance) return;
  const at = world.require(e, Body).pos, from = world.require(target, Body).pos;
  const dx = at.x - from.x, dz = at.z - from.z, dist = Math.hypot(dx, dz) || 1;
  step.dir = { x: dx / dist, z: dz / dist };
  enter(world, e, enemy, "sidestep");
}

function grab(world: World, events: FightEvent[], e: Entity): void {
  const target = nearestInReach(world, e, GUARD_BREAK), player = target === null ? null : world.get(target, Player);
  if (target === null || (player && inIframes(player))) return;
  const g = POSTURE.grab, health = world.require(target, Health);
  const damage = hurt(world, target, physicalDamage(g.damage, world.require(e, FighterStats)), "physical");
  health.flash = HIT_FLASH_TIME;
  events.push({ type: "guardBreak", by: e, target, result: "broken" });
  events.push({ type: "hit", by: e, target, team: world.require(target, Fighter).team, damage, weapon: false });
  stagger(world, target, g.staggerTime);
  addPosture(world, events, target, g.posture, e);
}

export function postureSwordsmanSystem(events: FightEvent[]): System {
  return (world, dt) => {
    for (const [e, attack, enemy, wielder] of world.query(WeaponAttack, Enemy, Wielder)) {
      const def = attack.def, sense = enemy.sense, move = enemy.move, swing = wielder.swing;
      const weapon = weaponIn(wielder.hands), target = sense.target;
      attack.cooldown -= dt;
      if (target !== null) readTheirs(world, e, enemy, attack, target);
      if (enemy.state === "staggered") Object.assign(attack, { swingsLeft: 0, perilousEnd: null });
      switch (enemy.state) {
        case "approach": {
          if (!weapon || !sense.targetAlive || target === null) break;
          const posture = world.require(e, Posture);
          if (attack.riposte) {
            Object.assign(attack, { riposte: false, swingsLeft: 0, chain: 1, perilousEnd: null });
            windUp(world, e, enemy, attack, weapon);
          } else if (attack.swingsLeft > 0 || attack.perilousEnd !== null) {
            next(world, e, enemy, attack, weapon);
          } else if (posture.value > def.posture.backOffShare * posture.max) {
            const near = sense.dist < def.triggerDist + def.posture.backOffM;
            move.speed = near ? -moveSpeed(enemy.def.walkSpeed, world.require(e, FighterStats)) : 0;
          } else if (attack.cooldown <= 0 && sense.dist < def.triggerDist && sense.facingDot > MIN_FACING_DOT) {
            const { minString, maxString } = def.posture;
            attack.swingsLeft = minString - 1 + Math.floor(roll(enemy) * (maxString - minString + 1));
            attack.chain = 0;
            attack.perilousEnd = pickEnd(enemy, attack);
            windUp(world, e, enemy, attack, weapon);
          }
          break;
        }
        case "weaponWindup":
        case "weapon":
          if (swing && swing.step < swing.liveAt) {
            enemy.yaw = turnToward(enemy.yaw, sense.toYaw, WINDUP_TURN_RAD_PER_SEC * dt);
            swing.dir = facing(enemy);
            break;
          }
          if (enemy.state === "weaponWindup") Object.assign(enemy, { state: "weapon", stateTime: 0 });
          if (swing && bladeLive(swing)) { move.speed = def.speed; move.accel = STEP_ACCEL; }
          if (swing && swing.step < swing.liveUntil) break;
          if (weapon) next(world, e, enemy, attack, weapon);
          break;
        case "guardBreak": {
          const windup = POSTURE.grab.windupTime * (weapon?.heft ?? 1);
          if (enemy.stateTime < windup) {
            enemy.yaw = turnToward(enemy.yaw, sense.toYaw, WINDUP_TURN_RAD_PER_SEC * dt);
            break;
          }
          grab(world, events, e);
          recover(enemy, attack, POSTURE.grab.recoverTime);
          break;
        }
        case "weaponRecover":
          if (enemy.stateTime >= enemy.duration) enter(world, e, enemy, "approach");
          break;
      }
    }
  };
}
