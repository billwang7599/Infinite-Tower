/** Overworld prefabs by id, for level spawn lists. New actor: add a file here (a list of behavior parts). */
import type { Entity, Vec2, World } from "@infinite-tower/shared";
import { spawnBoar } from "./boar.js";

export type OverworldPrefab = (world: World, at: Vec2) => Entity;

export const OVERWORLD_PREFABS = {
  boar: spawnBoar,
} satisfies Record<string, OverworldPrefab>;

export type OverworldPrefabId = keyof typeof OVERWORLD_PREFABS;
