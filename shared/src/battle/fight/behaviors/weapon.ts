import type { Entity, System, World } from "../../../core/ecs.js";
import { turnToward } from "../../../core/math.js";
import { FIXED_DT } from "../../../core/time.js";
import { toSteps } from "../../../core/time.js";
import {
  CHAIN, chainKind, HYBRID, isSwing, lastFeintStep, parryWay, WAYS, windupTime, type Strike, type SwingDir, type Way,
} from "../../../weapons/hybrid.js";
import { meleeIn } from "../../../weapons/kinds.js";
import { feltHeft, type Weapon } from "../../../weapons/weapons.js";
import { Enemy, WeaponAttack, Wielder, type EnemyData, type SwingData, type WeaponAttackData } from "../../components.js";
import { FighterStats, type Stats } from "../../stats.js";
import type { FightEvent } from "../context.js";
import { canSwing, carrySpeed, committed, feint as feintSwing, steer } from "../weapons/commit.js";
import { startWaySwing, strengthIn } from "../weapons/swing.js";
import { approachSpeed } from "./brain.js";
import { enter, roll } from "./common.js";

/** Starts only when facing the target this squarely (cos of the angle). */
const MIN_FACING_DOT = 0.8;
/** Keeps turning toward the target while winding up, this fast. */
const WINDUP_TURN_RAD_PER_SEC = 2.5;
const SWINGING = new Set(["weaponWindup", "weapon", "weaponRecover"]);
// Its parrying blade goes live this long before the player's: past a clash, inside the window.
const PARRY_LEAD_STEPS = toSteps(HYBRID.parry.clashTime) + 2;

const facing = (enemy: EnemyData) => ({ x: Math.sin(enemy.yaw), z: Math.cos(enemy.yaw) });

function pickWay(enemy: EnemyData, last: Way): Way {
  const others = WAYS.filter((way) => way !== last);
  return others[Math.floor(roll(enemy) * others.length)]!;
}

function windUp(
  world: World, e: Entity, enemy: EnemyData, attack: WeaponAttackData, weapon: Weapon, chained: boolean,
  parrying: { way: SwingDir; windupTime: number } | null = null,
): void {
  const last = attack.way, way = parrying?.way ?? pickWay(enemy, last);
  const strike: Strike = way === "stab" ? "stab" : !parrying && roll(enemy) < attack.def.heavyShare ? "heavy" : "light";
  attack.way = way;
  attack.feint = strike === "heavy" && roll(enemy) < attack.def.heavyFeintShare;
  const kind = chained && isSwing(way) ? chainKind(last, way) : "opening";
  startWaySwing(world, e, weapon, strike, way, parrying?.windupTime ?? windupTime(strike, kind), 1, facing(enemy));
  // Not `enter`: that would end the swing.
  const liveAt = world.require(e, Wielder).swing!.liveAt;
  Object.assign(enemy, { state: "weaponWindup", stateTime: 0, duration: liveAt * FIXED_DT });
}

function swingStarts(world: World, enemy: EnemyData, target: Entity): boolean {
  const swing = world.get(target, Wielder)?.swing;
  return swing?.step === 0 && enemy.sense.dist < enemy.def.attacks.weapon!.triggerDist
    && enemy.sense.facingDot > MIN_FACING_DOT;
}

function parry(
  world: World, e: Entity, enemy: EnemyData, attack: WeaponAttackData, weapon: Weapon, theirs: SwingData,
): boolean {
  const liveIn = theirs.liveAt - PARRY_LEAD_STEPS;
  if (!isSwing(theirs.way) || liveIn < toSteps(CHAIN.minWindupTime)) return false;
  attack.swingsLeft = 0;
  const heft = feltHeft(weapon, strengthIn(world, e));
  windUp(world, e, enemy, attack, weapon, false, { way: parryWay(theirs.way), windupTime: liveIn * FIXED_DT / heft });
  return true;
}

function feint(world: World, e: Entity, enemy: EnemyData, attack: WeaponAttackData, events: FightEvent[]): void {
  feintSwing(world, e, events);
  enter(world, e, enemy, "approach");
  enemy.stateTime = attack.def.blockReactTime;
  Object.assign(attack, { feint: false, swingsLeft: 0, cooldown: attack.def.cooldown });
}

function moveWhileSwinging(enemy: EnemyData, swing: SwingData | null, stats: Stats): void {
  const move = enemy.move, carry = swing && carrySpeed(swing);
  if (swing && carry !== null) {
    Object.assign(move, { dirX: swing.dir.x, dirZ: swing.dir.z, speed: carry, accel: Infinity });
  } else move.speed = approachSpeed(enemy, stats) * HYBRID.swinging.moveFactor;
}

export function weaponAttackSystem(events: FightEvent[]): System {
  return (world, dt) => {
    for (const [e, attack, enemy, wielder, stats] of world.query(WeaponAttack, Enemy, Wielder, FighterStats)) {
      const def = attack.def, sense = enemy.sense, swing = wielder.swing;
      const weapon = meleeIn(wielder.hands), ready = weapon && canSwing(wielder), target = sense.target;
      attack.cooldown -= dt;
      if (target !== null && swingStarts(world, enemy, target)) {
        attack.perfectBlockRead = roll(enemy) < def.perfectBlockChance;
        const theirs = world.require(target, Wielder).swing!;
        if (ready && !attack.perfectBlockRead && def.parryChance > 0 && enemy.state === "approach"
          && roll(enemy) < def.parryChance && parry(world, e, enemy, attack, weapon, theirs)) {
          moveWhileSwinging(enemy, wielder.swing, stats);
          continue;
        }
      }
      switch (enemy.state) {
        case "approach": {
          if (!ready || !sense.targetAlive || target === null || attack.cooldown > 0) break;
          if (sense.dist >= def.triggerDist || sense.facingDot <= MIN_FACING_DOT) break;
          if (attack.riposte) Object.assign(attack, { riposte: false, swingsLeft: 0 });
          else attack.swingsLeft = def.minChain - 1 + Math.floor(roll(enemy) * (def.maxChain - def.minChain + 1));
          windUp(world, e, enemy, attack, weapon, false);
          break;
        }
        case "weaponWindup":
        case "weapon":
          if (swing && attack.feint && swing.step >= lastFeintStep(swing.liveAt)) {
            feint(world, e, enemy, attack, events);
            break;
          }
          if (swing && swing.step < swing.liveAt) {
            enemy.yaw = turnToward(enemy.yaw, sense.toYaw, WINDUP_TURN_RAD_PER_SEC * dt);
            swing.dir = facing(enemy);
            break;
          }
          if (enemy.state === "weaponWindup") Object.assign(enemy, { state: "weapon", stateTime: 0 });
          if (swing) {
            steer(world, e, swing, { x: Math.sin(sense.toYaw), z: Math.cos(sense.toYaw) }, dt);
            enemy.yaw = Math.atan2(swing.dir.x, swing.dir.z);
            if (committed(swing)) break;
          }
          if (weapon && attack.swingsLeft > 0) {
            if (!canSwing(wielder)) break;
            attack.swingsLeft--;
            windUp(world, e, enemy, attack, weapon, true);
          } else {
            // Not `enter`: the blade recovers.
            const recover = swing ? (swing.endAt - swing.step) * FIXED_DT : 0;
            Object.assign(enemy, { state: "weaponRecover", stateTime: 0, duration: recover });
            attack.cooldown = recover + def.cooldown;
          }
          break;
        case "weaponRecover":
          if (enemy.stateTime >= enemy.duration) enter(world, e, enemy, "approach");
          break;
      }
      if (SWINGING.has(enemy.state)) moveWhileSwinging(enemy, wielder.swing, stats);
    }
  };
}
