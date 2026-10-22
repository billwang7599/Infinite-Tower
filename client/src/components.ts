/**
 * Client-only components: handles to Babylon objects. Gameplay data lives in @infinite-tower/shared.
 * Each one registers a remove hook so destroying an entity disposes its engine resources.
 */
import type { Material, Mesh, PhysicsAggregate, StandardMaterial, TransformNode } from "@babylonjs/core";
import { defineComponent, type World } from "@infinite-tower/shared";

/** A Havok body. For dynamic bodies Havok owns the transform: move it via velocity, never by setting position. */
export interface BodyData {
  aggregate: PhysicsAggregate;
  mesh: Mesh;
}
export const Body = defineComponent<BodyData>("Body");

/** A camera-facing 2D sprite, its blob shadow and its sword-slash effect. */
export interface SpriteViewData {
  root: TransformNode;
  plane: Mesh;
  shadow: Mesh;
  slash: Mesh;
  frames: { idle: Material; slash: Material; down: Material };
  facing: 1 | -1;
  /** Accumulated walk-cycle phase, for bobbing. */
  walkPhase: number;
  /** Smoothed squash/stretch factor. */
  stretch: number;
}
export const SpriteView = defineComponent<SpriteViewData>("SpriteView");

/** The boar's 3D model: a node hierarchy animated procedurally by boarViewSystem. */
export interface BoarViewData {
  /** Follows the physics body; rotated to the boar's facing. */
  root: TransformNode;
  /** Child of root: lean, tremble, fall over. */
  model: TransformNode;
  head: TransformNode;
  /** Hip pivots: front-left, front-right, back-left, back-right. */
  legs: TransformNode[];
  stars: TransformNode;
  /** Ground stripe showing the charge line during the wind-up. */
  telegraph: Mesh;
  materials: StandardMaterial[];
  eyes: StandardMaterial;
  gait: number;
  visualYaw: number;
}
export const BoarView = defineComponent<BoarViewData>("BoarView");

/** Plain meshes with no physics (decorations). */
export interface MeshesData { meshes: Mesh[] }
export const Meshes = defineComponent<MeshesData>("Meshes");

export function registerDisposers(world: World): void {
  world.onRemove(Body, (_e, b) => {
    b.aggregate.dispose();
    b.mesh.dispose(); // also disposes child nodes (sprite / boar model)
  });
  world.onRemove(SpriteView, (_e, s) => {
    s.shadow.dispose();
    s.slash.dispose();
    s.root.dispose();
  });
  world.onRemove(BoarView, (_e, v) => {
    v.telegraph.dispose();
    v.root.dispose();
    for (const m of v.materials) m.dispose();
  });
  world.onRemove(Meshes, (_e, m) => {
    for (const mesh of m.meshes) mesh.dispose();
  });
}
