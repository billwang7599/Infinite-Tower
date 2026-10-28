/** Overworld entities: the local player (LocalPlayer) is predicted, everything else drawn where the server says. */
import type { Mesh, StandardMaterial } from "@babylonjs/core";
import { defineComponent, type Vec2, type World } from "@infinite-tower/shared";
import type { ChibiFacing } from "../../gfx/look/look.js";
import type { Facing } from "./facing.js";

/** Drawn position, in tiles. */
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
  /** A picture for each way it can face (the player's chibi); null for actors with one picture. */
  facings: Record<ChibiFacing, StandardMaterial> | null;
  alert: Mesh | null;
  /** Grass drawn over the feet in tall grass. */
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
