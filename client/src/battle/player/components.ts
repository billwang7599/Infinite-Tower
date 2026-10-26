/** The arena player's visuals: a camera-facing 2D sprite, its blob shadow and its sword-slash trail. */
import type { Mesh } from "@babylonjs/core";
import { defineComponent, PLAYER, type World } from "@infinite-tower/shared";

/** The sprite quad's width and height. */
export const SPRITE_SIZE = 1.8;

/** Where the sprite's center sits above the capsule's, so its bottom edge stays on the feet. */
export const spriteY = (stretch: number, bob: number): number => -PLAYER.height / 2 + (SPRITE_SIZE / 2) * stretch + bob;

export interface PlayerSpriteData {
  /** Child of the physics capsule. */
  plane: Mesh;
  shadow: Mesh;
  slash: Mesh;
  /** -1 mirrors the sprite left to right (sprite.ts: every other swing). */
  facing: 1 | -1;
  /** Accumulated walk-cycle phase, for bobbing. */
  walkPhase: number;
  /** Smoothed squash/stretch factor. */
  stretch: number;
}
export const PlayerSprite = defineComponent<PlayerSpriteData>("PlayerSprite");

/** The plane goes with the capsule (Body's disposer); the shadow and the trail aren't parented to it. */
export function registerPlayerDisposers(world: World): void {
  world.onRemove(PlayerSprite, (_e, s) => {
    s.shadow.dispose();
    s.slash.dispose();
  });
}
