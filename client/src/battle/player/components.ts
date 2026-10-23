/** The arena player's visuals: a camera-facing 2D sprite, its blob shadow and its sword-slash trail. */
import type { Material, Mesh, TransformNode } from "@babylonjs/core";
import { defineComponent, type World } from "@infinite-tower/shared";

export interface PlayerSpriteData {
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
export const PlayerSprite = defineComponent<PlayerSpriteData>("PlayerSprite");

export function registerPlayerDisposers(world: World): void {
  world.onRemove(PlayerSprite, (_e, s) => {
    s.shadow.dispose();
    s.slash.dispose();
    s.root.dispose();
  });
}
