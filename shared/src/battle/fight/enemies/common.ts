/** Helpers shared by the enemy behaviors. */
import type { Entity, World } from "../../../core/ecs.js";
import { ActiveHit, type EnemyData, type EnemyState } from "../../components.js";
import type { AttackDef } from "../../defs.js";
import { addHit } from "../combat.js";

/** Switch state: restart its clock and end any live hitbox. */
export function enter(world: World, e: Entity, enemy: EnemyData, state: EnemyState, duration = 0): void {
  enemy.state = state;
  enemy.stateTime = 0;
  enemy.duration = duration;
  world.remove(e, ActiveHit);
}

/** Make the attack's hitbox live, aimed where the enemy faces. */
export function addHitAhead(world: World, e: Entity, enemy: EnemyData, attack: AttackDef): void {
  addHit(world, e, Math.sin(enemy.yaw), Math.cos(enemy.yaw), attack);
}
