import type { Entity, System, World } from "../../../core/ecs.js";
import { turnToward } from "../../../core/math.js";
import { FIXED_DT } from "../../../core/time.js";
import { planSwing, stepsUntil, weaponIn, type AttackKind, type Weapon } from "../../../weapons/weapons.js";
import { Enemy, WeaponAttack, Wielder, type EnemyData, type WeaponAttackData } from "../../components.js";
import type { WeaponAttackDef } from "../../defs.js";
import { FighterStats } from "../../stats.js";
import { startSwing } from "../weapons/swing.js";
import { enter, roll } from "./common.js";

/** Starts only when facing the target this squarely (cos of the angle). */
const MIN_FACING_DOT = 0.8;
/** Keeps turning toward the target while winding up, this fast. */
const WINDUP_TURN_RAD_PER_SEC = 2.5;
/** Velocity change per second as it steps into a swing. */
const STEP_ACCEL = 40;

/** One of its moves at random, not `last` (unless it has no other). */
function pick(enemy: EnemyData, attack: WeaponAttackData, last: AttackKind | null): AttackKind {
  const others = attack.def.moves.filter((m) => m !== last);
  const options = others.length > 0 ? others : attack.def.moves;
  return options[Math.floor(roll(enemy) * options.length)]!;
}

function windUp(
  world: World, e: Entity, enemy: EnemyData, def: WeaponAttackDef, weapon: Weapon, attack: AttackKind,
  telegraph: number,
): void {
  enter(world, e, enemy, "weaponWindup");
  const wielder = world.require(e, Wielder);
  const plan = planSwing(weapon, world.require(e, FighterStats).strength, wielder.blade, attack);
  const windup = Math.max(telegraph, plan.windupTime), active = def.active * plan.timeFactor;
  enemy.duration = windup;
  const liveAt = stepsUntil(windup), liveUntil = liveAt + stepsUntil(active);
  startSwing(world, e, {
    attack, dir: { x: Math.sin(enemy.yaw), z: Math.cos(enemy.yaw) }, driveAt: liveAt - stepsUntil(plan.driveTime),
    liveAt, liveUntil, letGoAt: liveUntil, endAt: liveUntil + stepsUntil(plan.followTime),
    damage: weapon.damage * plan.momentum, knockback: def.knockback, lift: def.lift, poiseDamage: 0,
    momentum: plan.momentum, startSpeed: plan.startSpeed, flow: plan.flow,
  });
}

export function weaponAttackSystem(): System {
  return (world, dt) => {
    for (const [e, attack, enemy, wielder] of world.query(WeaponAttack, Enemy, Wielder)) {
      const def = attack.def, sense = enemy.sense, move = enemy.move, swing = wielder.swing;
      const weapon = weaponIn(wielder.hands);
      attack.cooldown -= dt;
      attack.parryCooldown = Math.max(0, attack.parryCooldown - dt);
      switch (enemy.state) {
        case "approach": {
          const inReach = sense.dist < def.triggerDist && sense.facingDot > MIN_FACING_DOT;
          if (weapon && sense.targetAlive && attack.cooldown <= 0 && inReach) {
            attack.swingsLeft = def.minChain - 1 + Math.floor(roll(enemy) * (def.maxChain - def.minChain + 1));
            windUp(world, e, enemy, def, weapon, pick(enemy, attack, null), def.windup);
          }
          break;
        }
        case "weaponWindup":
          if (!swing) break;
          enemy.yaw = turnToward(enemy.yaw, sense.toYaw, WINDUP_TURN_RAD_PER_SEC * dt);
          swing.dir = { x: Math.sin(enemy.yaw), z: Math.cos(enemy.yaw) };
          // Not `enter`: that would end the swing going live.
          if (swing.step >= swing.liveAt) {
            const duration = (swing.liveUntil - swing.liveAt) * FIXED_DT;
            Object.assign(enemy, { state: "weapon", stateTime: 0, duration });
          }
          break;
        case "weapon":
          move.speed = def.speed; move.accel = STEP_ACCEL;
          if (swing && swing.step < swing.letGoAt) break;
          if (swing && weapon && attack.swingsLeft > 0) {
            attack.swingsLeft--;
            windUp(world, e, enemy, def, weapon, pick(enemy, attack, swing.attack), def.chainWindup);
          } else {
            // Not `enter`: the blade follows through.
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
