/**
 * Client-side overworld entities. They only mirror the server: the local player (tagged LocalPlayer) is
 * predicted from your inputs, everything else is drawn where the server says it is (mirror.ts).
 */
import type { Mesh, StandardMaterial } from "@babylonjs/core";
import { defineComponent, type Vec2, type World } from "@infinite-tower/shared";
import type { ChibiFacing } from "../gfx/look/look.js";
import type { Facing } from "./facing.js";

/** Drawn position on the overworld (tiles). */
export const OverworldPos = defineComponent<Vec2>("OverworldPos");

interface OverworldActorData {
  vx: number;
  vz: number;
  facing: Facing;
  /** Noticed you ("!"). */
  alert: boolean;
  /** Latest server position; the drawn position glides toward it. null for the predicted local player. */
  target: Vec2 | null;
}
export const OverworldActor = defineComponent<OverworldActorData>("OverworldActor");

/** The quad drawing an overworld entity, plus optional overlays. */
interface OverworldSpriteData {
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
export const OverworldSprite = defineComponent<OverworldSpriteData>("OverworldSprite");

export function registerOverworldDisposers(world: World): void {
  world.onRemove(OverworldSprite, (_e, s) => {
    s.mesh.dispose();
    s.alert?.dispose();
    s.tuft?.dispose();
  });
}
