/** Helpers shared by the enemy behaviors. */
import type { Entity, World } from "../../../core/ecs.js";
import { nextRandom } from "../../../core/math.js";
import {
  ChargeAttack, LungeAttack, PounceAttack, SlamAttack, WeaponAttack, type EnemyData, type EnemyState,
} from "../../components.js";
import { FighterStats, physicalDamage } from "../../stats.js";
import type { AttackDef } from "../../defs.js";
import { addHit } from "../combat.js";
import { endSwing } from "../weapons/swing.js";

export function enter(world: World, e: Entity, enemy: EnemyData, state: EnemyState, duration = 0): void {
  enemy.state = state;
  enemy.stateTime = 0;
  enemy.duration = duration;
  endSwing(world, e);
}

export function stun(world: World, e: Entity, enemy: EnemyData, state: "staggered" | "stunned", time: number): void {
  enter(world, e, enemy, state, time);
  const weapon = world.get(e, WeaponAttack);
  if (weapon) Object.assign(weapon, { swingsLeft: 0, riposte: false, feint: false });
  for (const attack of [weapon, world.get(e, LungeAttack), world.get(e, ChargeAttack), world.get(e, SlamAttack)]) {
    if (attack) attack.cooldown = Math.max(attack.cooldown, time + attack.def.cooldown);
  }
  // Its cooldown counts only while it circles, not through the stun.
  const pounce = world.get(e, PounceAttack);
  if (pounce) pounce.cooldown = Math.max(pounce.cooldown, pounce.def.cooldown);
}

export function addHitAhead(
  world: World, e: Entity, enemy: EnemyData, attack: Pick<AttackDef, "range" | "minDot" | "damage" | "knockback">,
): void {
  const blunt = physicalDamage(attack.damage, world.require(e, FighterStats));
  addHit(world, e, Math.sin(enemy.yaw), Math.cos(enemy.yaw), { ...attack, damage: { slash: 0, stab: 0, blunt } });
}

/** 0..1. */
export function roll(enemy: EnemyData): number {
  const [value, next] = nextRandom(enemy.rng);
  enemy.rng = next;
  return value;
}
