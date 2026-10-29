import type { TransformNode } from "@babylonjs/core";
import type { ArenaDef, ArenaLook } from "@infinite-tower/shared";
import type { ArenaScene } from "../battle/scene.js";
import type { MapLight, SkyLook } from "../sky/sky.js";
import { FOREST_CLEARING } from "./forest-clearing/forest-clearing.js";
import { MIRE } from "./mire/mire.js";
import { STONE_RUINS } from "./stone-ruins/stone-ruins.js";

/** Only dressing: the floor and the wall you bump into are the fight's physics, the same in every arena. */
export interface ArenaLookDef {
  env: SkyLook;
  lights?(radius: number): MapLight[];
  build(ctx: ArenaScene, radius: number): TransformNode;
}

export const ARENA_LOOKS: Record<ArenaLook, ArenaLookDef> = {
  "forest-clearing": FOREST_CLEARING,
  "stone-ruins": STONE_RUINS,
  mire: MIRE,
};

/** Disposing the returned root takes the whole look away. */
export function showArena(ctx: ArenaScene, arena: ArenaDef): TransformNode {
  const look = ARENA_LOOKS[arena.look];
  ctx.sky.look(look.env, look.lights?.(arena.radius) ?? []);
  return look.build(ctx, arena.radius);
}
