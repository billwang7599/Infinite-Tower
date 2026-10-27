/** Overworld actors by id, for level spawn lists: each a list of behavior parts. */
import type { Entity, Vec2, World } from "@infinite-tower/shared";
import { chaseOnSight } from "./behaviors/chase.js";
import { encounterOnTouch } from "./behaviors/touch.js";
import { wander } from "./behaviors/wander.js";
import { spawnActor } from "./parts.js";

type OverworldPrefab = (world: World, at: Vec2) => Entity;

export const OVERWORLD_PREFABS = {
  boar: (world, at) => spawnActor(world, "boar", at, [
    wander({ speed: 1.6 }),
    chaseOnSight({ range: 4.5, noticeTime: 0.5, speed: 3.4 }),
    encounterOnTouch({ range: 0.9, enemy: "wild-boar" }),
  ]),
  kobold: (world, at) => spawnActor(world, "kobold", at, [
    wander({ speed: 1.2 }),
    chaseOnSight({ range: 4, noticeTime: 0.6, speed: 3 }),
    encounterOnTouch({ range: 0.9, enemy: "kobold-swordsman" }),
  ]),
} satisfies Record<string, OverworldPrefab>;

export type OverworldPrefabId = keyof typeof OVERWORLD_PREFABS;
