/**
 * Arena components that hold Babylon objects (gameplay data lives in @infinite-tower/shared). Each
 * registers a remove hook so destroying an entity disposes its engine resources. The player's and each
 * enemy model's own visuals sit with them: player/components.ts, enemies/models/<model>/.
 */
import type { Mesh, PhysicsAggregate } from "@babylonjs/core";
import { defineComponent, type World } from "@infinite-tower/shared";

/** A Havok body. For dynamic bodies Havok owns the transform: move it via velocity, never by setting position. */
export interface BodyData {
  aggregate: PhysicsAggregate;
  mesh: Mesh;
}
export const Body = defineComponent<BodyData>("Body");

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
