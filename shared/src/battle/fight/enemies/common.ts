/** Helpers shared by the enemy behaviors. */
import type { Entity, World } from "../../../core/ecs.js";
import { nextRandom } from "../../../core/math.js";
import type { EnemyData, EnemyState } from "../../components.js";
import type { AttackDef } from "../../defs.js";
import { addHit } from "../combat.js";
import { endSwing } from "../weapons/swing.js";

export function enter(world: World, e: Entity, enemy: EnemyData, state: EnemyState, duration = 0): void {
  enemy.state = state;
  enemy.stateTime = 0;
  enemy.duration = duration;
  endSwing(world, e);
}

/** Make the attack's hitbox live, aimed where the enemy faces. */
export function addHitAhead(world: World, e: Entity, enemy: EnemyData, attack: AttackDef): void {
  addHit(world, e, Math.sin(enemy.yaw), Math.cos(enemy.yaw), attack);
}

/** 0..1. */
export function roll(enemy: EnemyData): number {
  const [value, next] = nextRandom(enemy.rng);
  enemy.rng = next;
  return value;
}
