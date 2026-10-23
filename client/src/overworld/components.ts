/**
 * Client-side field entities. These only mirror the server: the local player is predicted from your
 * inputs, boars are drawn where the server says they are.
 */
import type { Mesh } from "@babylonjs/core";
import { defineComponent, type Vec2, type World } from "@infinite-tower/shared";

/** Drawn position on the field (tiles). */
export const MapPos = defineComponent<Vec2>("MapPos");

export interface MapActorData {
  kind: "player" | "boar";
  vx: number;
  vz: number;
  facing: 1 | -1;
  /** Boar noticed you ("!"). */
  alert: boolean;
  /** Latest server position; the drawn position glides toward it (boars). null for the predicted player. */
  target: Vec2 | null;
}
export const MapActor = defineComponent<MapActorData>("MapActor");

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
