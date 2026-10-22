/** Client-only overworld components: handles to the flat quads that draw map entities. */
import type { Mesh } from "@babylonjs/core";
import { defineComponent, type World } from "@infinite-tower/shared";

/** The quad drawing a map entity, plus optional overlays. */
export interface MapSpriteData {
  mesh: Mesh;
  /** "!" bubble (boars). */
  alert: Mesh | null;
  /** Grass drawn over the feet in tall grass (player). */
  tuft: Mesh | null;
  size: number;
  walkPhase: number;
}
export const MapSprite = defineComponent<MapSpriteData>("MapSprite");

export function registerMapDisposers(world: World): void {
  world.onRemove(MapSprite, (_e, s) => {
    s.mesh.dispose();
    s.alert?.dispose();
    s.tuft?.dispose();
  });
}
