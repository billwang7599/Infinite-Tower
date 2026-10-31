import type { Entity, System, World } from "../../../../core/ecs.js";
import { turnToward } from "../../../../core/math.js";
import { FIXED_DT, toSteps } from "../../../../core/time.js";
import {
  BREAKS, breakerOf, cutWindupTime, STANCES, type CutMove, type Stance,
} from "../../../../weapons/master-cuts.js";
import { ENEMY_GUARD, weaponIn, type Weapon } from "../../../../weapons/weapons.js";
import {
  Cuts, Enemy, Player, WeaponAttack, Wielder, type EnemyData, type WeaponAttackData,
} from "../../../components.js";
import { enter, roll } from "../../behaviors/common.js";
import { MIN_FACING_DOT, STEP_ACCEL, WINDUP_TURN_RAD_PER_SEC } from "../../behaviors/weapon.js";
import type { FightEvent } from "../../context.js";
import { grabbable, inGrabReach, startGrab } from "../../weapons/guard-break.js";
import { bladeLive } from "../../weapons/swing.js";
import { fehler, fehlerable, guardOf, swingFrom } from "./guard.js";

const facing = (enemy: EnemyData) => ({ x: Math.sin(enemy.yaw), z: Math.cos(enemy.yaw) });

function otherThan(enemy: EnemyData, stance: Stance): Stance {
  const others = STANCES.filter((s) => s !== stance);
  return others[Math.floor(roll(enemy) * others.length)]!;
}

function holdFor(enemy: EnemyData, attack: WeaponAttackData): void {
  attack.guardHoldTime = ENEMY_GUARD.minHoldTime + roll(enemy) * (ENEMY_GUARD.maxHoldTime - ENEMY_GUARD.minHoldTime);
}

function swingNow(
  world: World, e: Entity, enemy: EnemyData, weapon: Weapon, move: CutMove, stance: Stance, chain: number, read: boolean,
): void {
  const attack = world.require(e, WeaponAttack), extra = read ? attack.def.masterCuts.windupExtraTime : 0;
  swingFrom(world, e, weapon, move, chain, facing(enemy), cutWindupTime(move, stance, chain) + extra);
  attack.feint = move === "strike" && read && roll(enemy) < attack.def.masterCuts.fehlerChance;
  const liveAt = world.require(e, Wielder).swing!.liveAt;
  // Not `enter`: that would end the swing.
  Object.assign(enemy, { state: "weaponWindup", stateTime: 0, duration: liveAt * FIXED_DT });
}

function watch(world: World, e: Entity, enemy: EnemyData, attack: WeaponAttackData, target: Entity): void {
  const mc = attack.def.masterCuts, theirs = guardOf(world, target), cuts = world.require(e, Cuts);
  if (theirs !== null && theirs !== attack.seenStance) {
    attack.seenStance = theirs;
    attack.reactSteps = toSteps(mc.reactTime);
  } else if (attack.reactSteps > 0 && --attack.reactSteps === 0 && attack.seenStance !== null
    && enemy.state === "approach" && roll(enemy) < mc.answerChance) {
    cuts.want = breakerOf(attack.seenStance);
    holdFor(enemy, attack);
  }
  const swing = world.get(target, Wielder)?.swing;
  if (!swing?.stance) {
    attack.parryRead = false;
    return;
  }
  if (swing.step !== 0) return;
  const mine = guardOf(world, e);
  const near = enemy.sense.dist < attack.def.triggerDist && enemy.sense.facingDot > MIN_FACING_DOT;
  const counterable = mine !== null && near && !(swing.attack === "heavy" && BREAKS[swing.stance] === mine);
  attack.parryRead = counterable
    && roll(enemy) < (BREAKS[mine] === swing.stance ? mc.displaceChance : mc.bindChance);
}

function approach(world: World, e: Entity, enemy: EnemyData, attack: WeaponAttackData, weapon: Weapon): void {
  const def = attack.def, mc = def.masterCuts, target = enemy.sense.target!, mine = guardOf(world, e);
  const incoming = world.get(target, Wielder)?.swing;
  if (mine === null) return;
  if (attack.parryRead && incoming && incoming.liveAt - incoming.step <= toSteps(mc.counterLeadTime)) {
    Object.assign(attack, { parryRead: false, swingsLeft: 0, chain: 0 });
    swingNow(world, e, enemy, weapon, "cut", mine, 0, false);
    return;
  }
  if (attack.riposte) {
    Object.assign(attack, { riposte: false, swingsLeft: 0, chain: 0 });
    swingNow(world, e, enemy, weapon, "strike", mine, 0, false);
    return;
  }
  attack.guardHoldTime -= FIXED_DT;
  if (attack.guardHoldTime <= 0) {
    world.require(e, Cuts).want = otherThan(enemy, mine);
    holdFor(enemy, attack);
    return;
  }
  const inReach = enemy.sense.dist < def.triggerDist && enemy.sense.facingDot > MIN_FACING_DOT;
  if (attack.cooldown > 0 || !inReach) return;
  if (world.get(target, Player)?.action === "none" && inGrabReach(world, e, target) && grabbable(world, target)
    && roll(enemy) < mc.wrestleChance) {
    enter(world, e, enemy, "guardBreak");
    startGrab(world.require(e, Wielder));
    return;
  }
  attack.chain = 0;
  if (guardOf(world, target) === BREAKS[mine] && roll(enemy) < mc.cutChance) {
    attack.swingsLeft = 0;
    swingNow(world, e, enemy, weapon, "cut", mine, 0, true);
    return;
  }
  attack.swingsLeft = mc.minString - 1 + Math.floor(roll(enemy) * (mc.maxString - mc.minString + 1));
  swingNow(world, e, enemy, weapon, "strike", mine, 0, true);
}

function next(world: World, e: Entity, enemy: EnemyData, attack: WeaponAttackData, weapon: Weapon): void {
  const cuts = world.require(e, Cuts), mc = attack.def.masterCuts;
  if (attack.swingsLeft <= 0) {
    // Not `enter`: the blade recovers.
    Object.assign(enemy, { state: "weaponRecover", stateTime: 0, duration: mc.recoverTime });
    attack.cooldown = mc.recoverTime + attack.def.cooldown;
    return;
  }
  const mine = guardOf(world, e);
  if (mine === null || mine !== cuts.want) return;
  attack.swingsLeft--;
  attack.chain++;
  swingNow(world, e, enemy, weapon, "strike", mine, attack.chain, true);
}

export function masterCutsSwordsmanSystem(events: FightEvent[]): System {
  return (world, dt) => {
    for (const [e, attack, enemy, wielder] of world.query(WeaponAttack, Enemy, Wielder)) {
      const sense = enemy.sense, swing = wielder.swing, weapon = weaponIn(wielder.hands), target = sense.target;
      if (!world.has(e, Cuts)) continue;
      attack.cooldown -= dt;
      if (target !== null) watch(world, e, enemy, attack, target);
      if (enemy.state === "staggered" || enemy.state === "recoil") attack.swingsLeft = 0;
      switch (enemy.state) {
        case "approach":
          if (weapon && sense.targetAlive && target !== null) approach(world, e, enemy, attack, weapon);
          break;
        case "weaponWindup":
        case "weapon":
          if (swing && swing.step < swing.liveAt) {
            enemy.yaw = turnToward(enemy.yaw, sense.toYaw, WINDUP_TURN_RAD_PER_SEC * dt);
            swing.dir = facing(enemy);
            const mine = world.require(e, Cuts).to;
            if (attack.feint && swing.liveAt - swing.step <= toSteps(attack.def.masterCuts.fehlerLeadTime)
              && fehlerable(world, e, swing)) {
              attack.feint = false;
              fehler(world, events, e, swing, otherThan(enemy, mine));
            }
            break;
          }
          if (enemy.state === "weaponWindup") enemy.state = "weapon";
          if (swing && bladeLive(swing)) {
            enemy.move.speed = attack.def.speed;
            enemy.move.accel = STEP_ACCEL;
          }
          if (swing && swing.step < swing.liveUntil) break;
          if (swing?.step === swing?.liveUntil && attack.swingsLeft > 0) {
            world.require(e, Cuts).want = STANCES[Math.floor(roll(enemy) * STANCES.length)]!;
          }
          if (weapon) next(world, e, enemy, attack, weapon);
          break;
        case "weaponRecover":
          if (enemy.stateTime >= enemy.duration) enter(world, e, enemy, "approach");
          break;
      }
    }
  };
}
