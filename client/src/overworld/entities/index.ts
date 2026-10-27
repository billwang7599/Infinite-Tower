/** How to draw each kind of server actor (ActorSnap.kind). New actor kind: add a file here and list it. */
import type { ActorSnap, Entity, Vec2, World } from "@infinite-tower/shared";
import type { OverworldView } from "../scene.js";
import { spawnOverworldBoar } from "./boar.js";
import { spawnOverworldKobold } from "./kobold.js";

type OverworldPrefab = (world: World, view: OverworldView, at: Vec2) => Entity;

export const OVERWORLD_PREFABS: Record<ActorSnap["kind"], OverworldPrefab> = {
  boar: spawnOverworldBoar,
  kobold: spawnOverworldKobold,
};
