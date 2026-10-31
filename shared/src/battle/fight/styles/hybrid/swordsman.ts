import type { Entity, System, World } from "../../../../core/ecs.js";
import { turnToward } from "../../../../core/math.js";
import { FIXED_DT } from "../../../../core/time.js";
import { HYBRID, WAYS, type Strike, type Way } from "../../../../weapons/hybrid.js";
import { weaponIn, type Weapon } from "../../../../weapons/weapons.js";
import {
  Enemy, Player, WeaponAttack, Wielder, type EnemyData, type WeaponAttackData,
} from "../../../components.js";
import type { HybridSwordsmanDef } from "../../../defs.js";
import { MIN_FACING_DOT, STEP_ACCEL, WINDUP_TURN_RAD_PER_SEC } from "../../behaviors/weapon.js";
import { enter, roll } from "../../behaviors/common.js";
import { inReach } from "../../weapons/guard-break.js";
import { bladeLive, startWaySwing } from "../../weapons/swing.js";

const facing = (enemy: EnemyData) => ({ x: Math.sin(enemy.yaw), z: Math.cos(enemy.yaw) });

function pickWay(enemy: EnemyData, last: Way): Way {
  const others = WAYS.filter((way) => way !== last);
  return others[Math.floor(roll(enemy) * others.length)]!;
}

function windUp(
  world: World, e: Entity, enemy: EnemyData, attack: WeaponAttackData, weapon: Weapon, windupTime: number,
): void {
  const way = pickWay(enemy, attack.way);
  const strike: Strike = way === "stab" ? "stab" : roll(enemy) < attack.def.heavyShare ? "heavy" : "light";
  attack.way = way;
  const extra = strike === "heavy" ? HYBRID.heavy.extraTime : 0;
  startWaySwing(world, e, weapon, strike, way, windupTime + extra, 1, facing(enemy));
  // Not `enter`: that would end the swing.
  const liveAt = world.require(e, Wielder).swing!.liveAt;
  Object.assign(enemy, { state: "weaponWindup", stateTime: 0, duration: liveAt * FIXED_DT });
}

function swingStarts(world: World, enemy: EnemyData, target: Entity): boolean {
  const swing = world.get(target, Wielder)?.swing;
  return swing?.step === 0 && enemy.sense.dist < enemy.def.attacks.weapon!.triggerDist
    && enemy.sense.facingDot > MIN_FACING_DOT;
}

const turtling = (world: World, target: Entity, hybrid: HybridSwordsmanDef): boolean => {
  const player = world.get(target, Player);
  return player?.action === "block" && player.actionTime >= hybrid.kickAfterTime;
};

export function hybridSwordsmanSystem(): System {
  return (world, dt) => {
    for (const [e, attack, enemy, wielder] of world.query(WeaponAttack, Enemy, Wielder)) {
      const def = attack.def, hybrid = def.hybrid, sense = enemy.sense, move = enemy.move, swing = wielder.swing;
      const weapon = weaponIn(wielder.hands), target = sense.target;
      attack.cooldown -= dt;
      attack.kickWait = Math.max(0, attack.kickWait - dt);
      if (target !== null && swingStarts(world, enemy, target)) attack.parryRead = roll(enemy) < hybrid.tapParryChance;
      switch (enemy.state) {
        case "approach": {
          if (!weapon || !sense.targetAlive || target === null) break;
          if (attack.riposte) {
            Object.assign(attack, { riposte: false, swingsLeft: 0 });
            windUp(world, e, enemy, attack, weapon, hybrid.chainWindupTime);
          } else if (turtling(world, target, hybrid) && attack.kickWait <= 0
            && inReach(world, e, target, HYBRID.kick)) {
            attack.kickWait = hybrid.kickAfterTime;
            if (roll(enemy) < hybrid.kickChance) {
              enter(world, e, enemy, "kick");
              wielder.kick = { step: 0 };
            }
          } else if (attack.cooldown <= 0 && sense.dist < def.triggerDist && sense.facingDot > MIN_FACING_DOT) {
            attack.swingsLeft = def.minChain - 1 + Math.floor(roll(enemy) * (def.maxChain - def.minChain + 1));
            windUp(world, e, enemy, attack, weapon, hybrid.windupTime);
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
          if (weapon && attack.swingsLeft > 0) {
            attack.swingsLeft--;
            windUp(world, e, enemy, attack, weapon, hybrid.chainWindupTime);
          } else {
            // Not `enter`: the blade recovers.
            Object.assign(enemy, { state: "weaponRecover", stateTime: 0, duration: hybrid.recoverTime });
            attack.cooldown = hybrid.recoverTime + def.cooldown;
          }
          break;
        case "weaponRecover":
          if (enemy.stateTime >= hybrid.recoverTime) enter(world, e, enemy, "approach");
          break;
      }
    }
  };
}
