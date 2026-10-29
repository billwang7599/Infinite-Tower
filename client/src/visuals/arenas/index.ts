import type { Mesh } from "@babylonjs/core";
import type { ArenaLook } from "@infinite-tower/shared";
import type { ArenaScene } from "../battle/scene.js";
import { buildGrassFieldArena } from "./grass-field/grass-field.js";

export const ARENA_LOOKS: Record<ArenaLook, (ctx: ArenaScene, radius: number) => Mesh[]> = {
  "grass-field": buildGrassFieldArena,
};
