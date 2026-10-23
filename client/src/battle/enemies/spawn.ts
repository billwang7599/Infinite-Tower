/**
 * The enemy prefab: builds an arena enemy from its def (sent by the server with the encounter).
 * Body + model + the common Enemy brain, then one component per attack the def lists. Each attack
 * component has its own system (behaviors/), so a new enemy is mostly a new combination of attacks.
 */
import { MeshBuilder, PhysicsAggregate, PhysicsShapeType, Vector3 } from "@babylonjs/core";
import {
  ChargeAttack, Enemy, Fighter, GoreAttack, Health, type EnemyAttacks, type EnemyDef, type Entity, type Vec3, type World,
} from "@infinite-tower/shared";
import { Body } from "../components.js";
import { Layer, type BattleContext } from "../context.js";
import { ENEMY_MODELS } from "./models/index.js";

/** How to add each kind of attack to an entity. */
const ATTACKS: { [K in keyof EnemyAttacks]-?: (world: World, e: Entity, def: NonNullable<EnemyAttacks[K]>) => void } = {
  gore: (world, e, def) => { world.add(e, GoreAttack, { def, cooldown: def.firstDelay }); },
  charge: (world, e, def) => { world.add(e, ChargeAttack, { def, cooldown: def.firstDelay, dir: { x: 0, z: 1 } }); },
};

/** Spawns an arena enemy at `at` (feet), facing `yaw`. */
export function spawnEnemy(ctx: BattleContext, def: EnemyDef, at: Vec3, yaw: number): Entity {
  const { world, scene } = ctx;
  const e = world.spawn();

  const collider = MeshBuilder.CreateSphere(`enemy-${e}`, { diameter: def.radius * 2, segments: 8 }, scene);
  collider.position.set(at.x, at.y + def.radius, at.z);
  collider.isVisible = false;
  const aggregate = new PhysicsAggregate(collider, PhysicsShapeType.SPHERE, { mass: def.mass, friction: 0, restitution: 0 }, scene);
  aggregate.body.setMassProperties({ mass: def.mass, inertia: Vector3.Zero() });
  aggregate.shape.filterMembershipMask = Layer.Enemy;
  aggregate.shape.filterCollideMask = Layer.Ground | Layer.Wall | Layer.Player;
  world.add(e, Body, { aggregate, mesh: collider });

  ENEMY_MODELS[def.model].add(ctx, e, collider, def, yaw);

  world.add(e, Enemy, {
    def, state: "approach", t: 0, duration: 0, yaw, poise: def.poise, armored: false,
    sense: { dist: Infinity, toYaw: yaw, facing: 1, preyAlive: false },
    move: { dirX: 0, dirZ: 0, speed: 0, accel: 0, halt: false },
  });
  for (const [kind, attack] of Object.entries(def.attacks) as [keyof EnemyAttacks, never][]) {
    if (attack) ATTACKS[kind](world, e, attack);
  }
  world.add(e, Health, { hp: def.maxHp, max: def.maxHp, invuln: 0, hitstun: 0, flash: 0 });
  world.add(e, Fighter, { team: "enemy", radius: def.radius });
  return e;
}
