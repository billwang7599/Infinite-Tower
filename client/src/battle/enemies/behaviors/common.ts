/** Helpers shared by the enemy behaviors. */
import {
  ActiveHit, FighterStats, physicalDamage, type AttackDef, type EnemyData, type Entity, type World,
} from "@infinite-tower/shared";

/** Switch state: restart its clock and end any live hitbox. */
export function enter(world: World, e: Entity, enemy: EnemyData, state: string, duration = 0): void {
  enemy.state = state;
  enemy.t = 0;
  enemy.duration = duration;
  world.remove(e, ActiveHit);
}

/** Make the attack's hitbox live, aimed where the enemy faces, hitting as hard as its strength says. */
export function addHit(world: World, e: Entity, enemy: EnemyData, a: AttackDef): void {
  world.add(e, ActiveHit, {
    dirX: Math.sin(enemy.yaw), dirZ: Math.cos(enemy.yaw),
    range: a.range, minDot: a.minDot, damage: physicalDamage(a.damage, world.require(e, FighterStats)), knockback: a.knockback, lift: a.lift, poise: 0, hit: new Set(),
  });
}
