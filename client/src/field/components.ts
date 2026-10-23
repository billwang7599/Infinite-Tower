/**
 * Client-side field entities. They only mirror the server: the local player (tagged LocalPlayer) is
 * predicted from your inputs, everything else is drawn where the server says it is (mirror.ts).
 */
import type { Mesh } from "@babylonjs/core";
import { defineComponent, type Vec2, type World } from "@infinite-tower/shared";

/** Drawn position on the field (tiles). */
export const FieldPos = defineComponent<Vec2>("FieldPos");

export interface FieldActorData {
  vx: number;
  vz: number;
  facing: 1 | -1;
  /** Noticed you ("!"). */
  alert: boolean;
  /** Latest server position; the drawn position glides toward it. null for the predicted local player. */
  target: Vec2 | null;
}
export const FieldActor = defineComponent<FieldActorData>("FieldActor");

/** The quad drawing a field entity, plus optional overlays. */
export interface FieldSpriteData {
  mesh: Mesh;
  /** "!" bubble (boars). */
  alert: Mesh | null;
  /** Grass drawn over the feet in tall grass (player). */
  tuft: Mesh | null;
  size: number;
  walkPhase: number;
}
export const FieldSprite = defineComponent<FieldSpriteData>("FieldSprite");

export function registerFieldDisposers(world: World): void {
  world.onRemove(FieldSprite, (_e, s) => {
    s.mesh.dispose();
    s.alert?.dispose();
    s.tuft?.dispose();
  });
}
