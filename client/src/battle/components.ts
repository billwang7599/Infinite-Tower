/**
 * Arena components that hold Babylon objects (gameplay data lives in @infinite-tower/shared). Each
 * registers a remove hook so destroying an entity disposes its engine resources. The player's and each
 * enemy model's own visuals sit with them: player/components.ts, enemies/models/<model>/.
 */
import {
  PhysicsAggregate, type Mesh, type PhysicsMassProperties, type PhysicsShapeType,
} from "@babylonjs/core";
import { defineComponent, type Entity, type World } from "@infinite-tower/shared";

/** Havok collision filter groups (bit masks). */
export const Layer = {
  Ground: 1 << 0,
  Player: 1 << 1,
  Wall: 1 << 2,
  Enemy: 1 << 3,
} as const;

/** A Havok body. For dynamic bodies Havok owns the transform: move it via velocity, never by setting position. */
export interface BodyData {
  aggregate: PhysicsAggregate;
  mesh: Mesh;
}
export const Body = defineComponent<BodyData>("Body");

export interface BodyOptions {
  /** 0: static. */
  mass: number;
  friction: number;
  /** The Layer it's in, and the layers it bumps into (default: all). */
  layer: number;
  collidesWith?: number;
  /**
   * Replaces the mass properties once the body exists. Zero inertia keeps it from ever tipping over; leaving
   * out `mass` there makes Havok work the mass out from the shape instead.
   */
  massProperties?: PhysicsMassProperties;
}

/** Gives `e` a Havok body built on `mesh`. */
export function addBody(world: World, e: Entity, mesh: Mesh, shape: PhysicsShapeType, opts: BodyOptions): BodyData {
  const physics = { mass: opts.mass, friction: opts.friction, restitution: 0 };
  const aggregate = new PhysicsAggregate(mesh, shape, physics, mesh.getScene());
  if (opts.massProperties) aggregate.body.setMassProperties(opts.massProperties);
  aggregate.shape.filterMembershipMask = opts.layer;
  if (opts.collidesWith !== undefined) aggregate.shape.filterCollideMask = opts.collidesWith;
  return world.add(e, Body, { aggregate, mesh });
}

/** Plain meshes with no physics (decorations). */
export interface MeshesData { meshes: Mesh[] }
export const Meshes = defineComponent<MeshesData>("Meshes");

export function registerBattleDisposers(world: World): void {
  world.onRemove(Body, (_e, b) => {
    b.aggregate.dispose();
    b.mesh.dispose(); // also disposes child nodes (sprite / enemy model)
  });
  world.onRemove(Meshes, (_e, m) => {
    for (const mesh of m.meshes) mesh.dispose();
  });
}
