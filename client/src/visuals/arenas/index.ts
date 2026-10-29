import { Color3, Color4, type TransformNode } from "@babylonjs/core";
import type { ArenaDef, ArenaLook } from "@infinite-tower/shared";
import type { ArenaScene } from "../battle/scene.js";
import { FOREST_CLEARING } from "./forest-clearing/forest-clearing.js";
import { MIRE } from "./mire/mire.js";
import { STONE_RUINS } from "./stone-ruins/stone-ruins.js";

export interface ArenaEnv {
  /** The clear colour, and the fog's. */
  sky: Color3;
  fogDensity: number;
  ambient: Color3;
  skyLight: { color: Color3; ground: Color3; intensity: number };
  sun: { color: Color3; intensity: number };
}

/** Only dressing: the floor and the wall you bump into are the fight's physics, the same in every arena. */
export interface ArenaLookDef {
  env: ArenaEnv;
  build(ctx: ArenaScene, radius: number): TransformNode;
}

export const ARENA_LOOKS: Record<ArenaLook, ArenaLookDef> = {
  "forest-clearing": FOREST_CLEARING,
  "stone-ruins": STONE_RUINS,
  mire: MIRE,
};

/** Disposing the returned root takes the whole look away. */
export function showArena(ctx: ArenaScene, arena: ArenaDef): TransformNode {
  const { env, build } = ARENA_LOOKS[arena.look];
  const { scene, sun, skyLight } = ctx;
  scene.clearColor = new Color4(env.sky.r, env.sky.g, env.sky.b, 1);
  scene.fogColor = env.sky;
  scene.fogDensity = env.fogDensity;
  scene.ambientColor = env.ambient;
  skyLight.diffuse = env.skyLight.color;
  skyLight.groundColor = env.skyLight.ground;
  skyLight.intensity = env.skyLight.intensity;
  sun.diffuse = env.sun.color;
  sun.intensity = env.sun.intensity;
  return build(ctx, arena.radius);
}
