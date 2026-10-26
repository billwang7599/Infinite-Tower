/**
 * Client-side field entities. They only mirror the server: the local player (tagged LocalPlayer) is
 * predicted from your inputs, everything else is drawn where the server says it is (mirror.ts).
 */
import type { Mesh, StandardMaterial } from "@babylonjs/core";
import { defineComponent, type Vec2, type World } from "@infinite-tower/shared";
import type { ChibiFacing } from "../gfx/look/look.js";
import type { Facing } from "./facing.js";

/** Drawn position on the field (tiles). */
export const FieldPos = defineComponent<Vec2>("FieldPos");

interface FieldActorData {
  vx: number;
  vz: number;
  facing: Facing;
  /** Noticed you ("!"). */
  alert: boolean;
  /** Latest server position; the drawn position glides toward it. null for the predicted local player. */
  target: Vec2 | null;
}
export const FieldActor = defineComponent<FieldActorData>("FieldActor");

/** The quad drawing a field entity, plus optional overlays. */
interface FieldSpriteData {
  mesh: Mesh;
  /**
   * A picture for each way it can face (the player's chibi): front, back, and side drawn facing right (left
   * mirrors it). null for actors with one picture, drawn facing right (boars).
   */
  facings: Record<ChibiFacing, StandardMaterial> | null;
  /** "!" bubble (boars). */
  alert: Mesh | null;
  /** Grass drawn over the feet in tall grass (player). */
  tuft: Mesh | null;
  /** Tiles across. */
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
