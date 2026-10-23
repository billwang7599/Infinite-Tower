/** Assembles the boar from components: Havok sphere collider, 3D model, AI state. */
import { MeshBuilder, PhysicsAggregate, PhysicsShapeType, Vector3 } from "@babylonjs/core";
import { type BoarDef, type Entity, type Vec3, Health, Fighter, Boar } from "@infinite-tower/shared";
import { Body, BoarView } from "../components.js";
import { Layer, type GameContext } from "../context.js";
import { buildBoarModel } from "./boarModel.js";

/** Spawns the arena boar at `at`, facing `yaw`. `def`: its stats, from the server's encounter. */
export function spawnBoar(ctx: GameContext, def: BoarDef, at: Vec3, yaw: number): Entity {
  const { world, scene } = ctx;
  const e = world.spawn();

  const collider = MeshBuilder.CreateSphere(`boar-${e}`, { diameter: def.radius * 2, segments: 8 }, scene);
  collider.position.set(at.x, at.y + def.radius, at.z);
  collider.isVisible = false;
  const aggregate = new PhysicsAggregate(collider, PhysicsShapeType.SPHERE, { mass: def.mass, friction: 0, restitution: 0 }, scene);
  aggregate.body.setMassProperties({ mass: def.mass, inertia: Vector3.Zero() });
  aggregate.shape.filterMembershipMask = Layer.Enemy;
  aggregate.shape.filterCollideMask = Layer.Ground | Layer.Wall | Layer.Player;
  world.add(e, Body, { aggregate, mesh: collider });

  const view = buildBoarModel(ctx, e, collider, def);
  view.root.rotation.y = yaw;
  world.add(e, BoarView, { ...view, gait: 0, visualYaw: yaw });
  world.add(e, Boar, {
    def, state: "approach", t: 0, yaw, chargeCooldown: 2.0, goreCooldown: 0, chargeDir: { x: 0, z: 1 }, poise: def.poise,
  });
  world.add(e, Health, { hp: def.maxHp, max: def.maxHp, invuln: 0, hitstun: 0, flash: 0 });
  world.add(e, Fighter, { team: "enemy", radius: def.radius });
  return e;
}
