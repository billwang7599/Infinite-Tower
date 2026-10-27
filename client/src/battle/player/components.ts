/** The arena player's visuals: a camera-facing 2D sprite, its blob shadow, the sword's trail, thrust and guard. */
import type { Mesh, TransformNode } from "@babylonjs/core";
import { defineComponent, PLAYER, type World } from "@infinite-tower/shared";

/** The sprite quad's width and height. */
export const SPRITE_SIZE = 1.8;

/** Where the sprite's center sits above the body's, so its bottom edge stays on the feet. */
export const spriteY = (stretch: number, bob: number): number => -PLAYER.height / 2 + (SPRITE_SIZE / 2) * stretch + bob;

export interface PlayerSpriteData {
  /** Under the body's node (BodyNode). */
  plane: Mesh;
  shadow: Mesh;
  /** Turned to the aim and the swing's line; the crescent under it sweeps along that line. */
  trail: TransformNode;
  slash: Mesh;
  /** Turned to the aim: the stab's streak, and the block's guard. */
  thrust: TransformNode;
  guard: TransformNode;
  /** Accumulated walk-cycle phase, for bobbing. */
  walkPhase: number;
  /** Smoothed squash/stretch factor. */
  stretch: number;
}
export const PlayerSprite = defineComponent<PlayerSpriteData>("PlayerSprite");

/** The plane goes with the body's node (BodyNode's disposer); the shadow and the sword's effects aren't under it. */
export function registerPlayerDisposers(world: World): void {
  world.onRemove(PlayerSprite, (_e, s) => {
    s.shadow.dispose();
    for (const node of [s.trail, s.thrust, s.guard]) node.dispose();
  });
}
