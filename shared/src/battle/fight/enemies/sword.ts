import type { Entity, System, World } from "../../../core/ecs.js";
import { turnToward } from "../../../core/math.js";
import { stepsUntil, type AttackKind } from "../../../weapons/weapons.js";
import { Enemy, SwordAttack, Wielder, type EnemyData, type SwordAttackData } from "../../components.js";
import type { SwordDef } from "../../defs.js";
import { startSwing } from "../weapons/swing.js";
import { enter, roll } from "./common.js";

/** Starts only when facing the target this squarely (cos of the angle). */
const MIN_FACING_DOT = 0.8;
/** Keeps turning toward the target while winding up, this fast. */
const WINDUP_TURN_RAD_PER_SEC = 2.5;
/** Velocity change per second as it steps into a swing. */
const STEP_ACCEL = 40;

/** One of its moves at random, not `last` (unless it has no other). */
function pick(enemy: EnemyData, sword: SwordAttackData, last: AttackKind | null): AttackKind {
  const others = sword.def.moves.filter((m) => m !== last);
  const options = others.length > 0 ? others : sword.def.moves;
  return options[Math.floor(roll(enemy) * options.length)]!;
}

function windUp(world: World, e: Entity, enemy: EnemyData, def: SwordDef, attack: AttackKind, windup: number): void {
  enter(world, e, enemy, "swordWindup", windup);
  const liveAt = stepsUntil(windup), liveUntil = liveAt + stepsUntil(def.active);
  startSwing(world, e, {
    attack, dir: { x: Math.sin(enemy.yaw), z: Math.cos(enemy.yaw) }, liveAt, liveUntil, letGoAt: liveUntil,
    endAt: liveUntil, damage: def.damage, knockback: def.knockback, lift: def.lift, poiseDamage: 0,
  });
}

export function swordAttackSystem(): System {
  return (world, dt) => {
    for (const [e, sword, enemy, wielder] of world.query(SwordAttack, Enemy, Wielder)) {
      const def = sword.def, sense = enemy.sense, move = enemy.move, swing = wielder.swing;
      sword.cooldown -= dt;
      sword.parryCooldown = Math.max(0, sword.parryCooldown - dt);
      switch (enemy.state) {
        case "approach": {
          const inReach = sense.dist < def.triggerDist && sense.facingDot > MIN_FACING_DOT;
          if (sense.targetAlive && sword.cooldown <= 0 && inReach) {
            sword.swingsLeft = def.minChain - 1 + Math.floor(roll(enemy) * (def.maxChain - def.minChain + 1));
            windUp(world, e, enemy, def, pick(enemy, sword, null), def.windup);
          }
          break;
        }
        case "swordWindup":
          if (!swing) break;
          enemy.yaw = turnToward(enemy.yaw, sense.toYaw, WINDUP_TURN_RAD_PER_SEC * dt);
          swing.dir = { x: Math.sin(enemy.yaw), z: Math.cos(enemy.yaw) };
          // Not `enter`: that would end the swing going live.
          if (swing.step >= swing.liveAt) Object.assign(enemy, { state: "sword", stateTime: 0, duration: def.active });
          break;
        case "sword":
          move.speed = def.speed; move.accel = STEP_ACCEL;
          if (swing && swing.step < swing.endAt) break;
          if (swing && sword.swingsLeft > 0) {
            sword.swingsLeft--;
            windUp(world, e, enemy, def, pick(enemy, sword, swing.attack), def.chainWindup);
          } else {
            enter(world, e, enemy, "swordRecover", def.recover);
            sword.cooldown = def.recover + def.cooldown;
          }
          break;
        case "swordRecover":
          if (enemy.stateTime >= def.recover) enter(world, e, enemy, "approach");
          break;
      }
    }
  };
}
