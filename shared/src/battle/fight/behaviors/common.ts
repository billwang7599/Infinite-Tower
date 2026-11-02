/** Helpers shared by the enemy behaviors. */
import type { Entity, World } from "../../../core/ecs.js";
import { nextRandom } from "../../../core/math.js";
import type { EnemyData, EnemyState } from "../../components.js";
import { FighterStats, physicalDamage } from "../../stats.js";
import { addHit, type HitSpec } from "../combat.js";
import { endSwing } from "../weapons/swing.js";

export function enter(world: World, e: Entity, enemy: EnemyData, state: EnemyState, duration = 0): void {
  enemy.state = state;
  enemy.stateTime = 0;
  enemy.duration = duration;
  endSwing(world, e);
}

export function addHitAhead(world: World, e: Entity, enemy: EnemyData, attack: HitSpec): void {
  const damage = physicalDamage(attack.damage, world.require(e, FighterStats));
  addHit(world, e, Math.sin(enemy.yaw), Math.cos(enemy.yaw), { ...attack, damage });
}

/** 0..1. */
export function roll(enemy: EnemyData): number {
  const [value, next] = nextRandom(enemy.rng);
  enemy.rng = next;
  return value;
}
