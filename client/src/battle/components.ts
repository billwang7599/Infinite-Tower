/**
 * Arena components that hold Babylon objects. The fight's own state is shared (Body, Health, ...) and lives in the
 * Fight's world; the client hangs its drawings off the same entities. Each registers a remove hook so destroying an
 * entity disposes its engine resources. The player's and each enemy model's own visuals sit with them:
 * player/components.ts, enemies/models/<model>/.
 */
import type { Mesh, TransformNode } from "@babylonjs/core";
import { defineComponent, type Vec3, type World } from "@infinite-tower/shared";

/** The node a fighter's drawing hangs from, put where its Body is every frame (systems/follow.ts). */
export interface BodyNodeData { node: TransformNode }
export const BodyNode = defineComponent<BodyNodeData>("BodyNode");

/**
 * How far your fighter's drawing is from its body (m): when the server corrects your prediction, the body jumps to
 * the right place at once and the drawing eases after it (systems/follow.ts), so small corrections don't pop.
 */
export const DrawOffset = defineComponent<Vec3>("DrawOffset");

/** Corrections bigger than this (m), like a hit's knockback, are shown as they are rather than eased. */
const MAX_EASED_CORRECTION = 1;

/** The body was just moved by `moved`: the drawing stays where it was, to ease over (or jumps, for a big move). */
export function easeCorrection(offset: Vec3, moved: Vec3): void {
  const x = offset.x - moved.x, y = offset.y - moved.y, z = offset.z - moved.z;
  const far = Math.hypot(x, y, z) > MAX_EASED_CORRECTION;
  Object.assign(offset, far ? { x: 0, y: 0, z: 0 } : { x, y, z });
}

/** Plain meshes with no part in the fight (decorations). */
export interface MeshesData { meshes: Mesh[] }
export const Meshes = defineComponent<MeshesData>("Meshes");

/** On the game's world: the arena's scenery. */
export function registerArenaDisposers(world: World): void {
  world.onRemove(Meshes, (_e, m) => {
    for (const mesh of m.meshes) mesh.dispose();
  });
}

/** On each fight's world: disposing a fighter's node disposes everything under it (sprite, enemy model). */
export function registerFighterDisposers(world: World): void {
  world.onRemove(BodyNode, (_e, b) => b.node.dispose());
}
