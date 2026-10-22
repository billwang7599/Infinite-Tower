/** Assembles the boar from components: Havok sphere collider, 3D model, AI state. */
import { MeshBuilder, PhysicsAggregate, PhysicsShapeType, Vector3 } from "@babylonjs/core";
import { type Entity, type Vec3, Health, Fighter, Boar, BOAR } from "@infinite-tower/shared";
import { Body, BoarView } from "../components.js";
import { Layer, type GameContext } from "../context.js";
import { buildBoarModel } from "./boarModel.js";

/** Spawns the arena boar at `at`, facing `yaw`. */
export function spawnBoar(ctx: GameContext, at: Vec3, yaw: number): Entity {
  const { world, scene } = ctx;
  const e = world.spawn();

  const collider = MeshBuilder.CreateSphere(`boar-${e}`, { diameter: BOAR.radius * 2, segments: 8 }, scene);
  collider.position.set(at.x, at.y + BOAR.radius, at.z);
  collider.isVisible = false;
  const aggregate = new PhysicsAggregate(collider, PhysicsShapeType.SPHERE, { mass: BOAR.mass, friction: 0, restitution: 0 }, scene);
  aggregate.body.setMassProperties({ mass: BOAR.mass, inertia: Vector3.Zero() });
  aggregate.shape.filterMembershipMask = Layer.Enemy;
  aggregate.shape.filterCollideMask = Layer.Ground | Layer.Wall | Layer.Player;
  world.add(e, Body, { aggregate, mesh: collider });

  const view = buildBoarModel(ctx, e, collider);
  view.root.rotation.y = yaw;
  world.add(e, BoarView, { ...view, gait: 0, visualYaw: yaw });
  world.add(e, Boar, {
    state: "approach", t: 0, yaw, chargeCooldown: 2.0, goreCooldown: 0, chargeDir: { x: 0, z: 1 }, poise: BOAR.poise,
  });
  world.add(e, Health, { hp: BOAR.maxHp, max: BOAR.maxHp, invuln: 0, hitstun: 0, flash: 0 });
  world.add(e, Fighter, { team: "enemy", radius: BOAR.radius });
  return e;
}
