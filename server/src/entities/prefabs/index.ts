/** Field prefabs by id, for level spawn lists. New actor: add a file here (a list of behavior parts). */
import type { Entity, Vec2, World } from "@infinite-tower/shared";
import { spawnBoar } from "./boar.js";

export type Prefab = (world: World, at: Vec2) => Entity;

export const PREFABS = {
  boar: spawnBoar,
} satisfies Record<string, Prefab>;

export type PrefabId = keyof typeof PREFABS;
