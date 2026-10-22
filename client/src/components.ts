/**
 * Client-only components: handles to Babylon objects. Gameplay data lives in @infinite-tower/shared.
 * Each one registers a remove hook so destroying an entity disposes its engine resources.
 */
import type { Mesh, PhysicsAggregate, TransformNode } from "@babylonjs/core";
import { defineComponent, type World } from "@infinite-tower/shared";

/** A Havok body. For dynamic bodies Havok owns the transform: move it via velocity, never by setting position. */
export interface BodyData {
  aggregate: PhysicsAggregate;
  mesh: Mesh;
}
export const Body = defineComponent<BodyData>("Body");

/** A camera-facing 2D sprite plus its blob shadow. */
export interface SpriteViewData {
  root: TransformNode;
  plane: Mesh;
  shadow: Mesh;
  facing: 1 | -1;
  /** Accumulated walk-cycle phase, for bobbing. */
  walkPhase: number;
  /** Smoothed squash/stretch factor. */
  stretch: number;
}
export const SpriteView = defineComponent<SpriteViewData>("SpriteView");

/** Plain meshes with no physics (decorations). */
export interface MeshesData { meshes: Mesh[] }
export const Meshes = defineComponent<MeshesData>("Meshes");

/** Tags a side wall (-1 left, +1 right) so the camera can fade it when orbiting to that side. */
export const SideWall = defineComponent<{ side: -1 | 1 }>("SideWall");

export function registerDisposers(world: World): void {
  world.onRemove(Body, (_e, b) => {
    b.aggregate.dispose();
    b.mesh.dispose();
  });
  world.onRemove(SpriteView, (_e, s) => {
    s.shadow.dispose();
    s.root.dispose();
  });
  world.onRemove(Meshes, (_e, m) => {
    for (const mesh of m.meshes) mesh.dispose();
  });
}
