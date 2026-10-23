/** How to draw each kind of server actor (ActorSnap.kind). New actor kind: add a file here and list it. */
import type { ActorSnap, Entity, Vec2, World } from "@infinite-tower/shared";
import type { MapView } from "../scene.js";
import { spawnMapBoar } from "./boar.js";

export type MapPrefab = (world: World, view: MapView, at: Vec2) => Entity;

export const MAP_PREFABS: Record<ActorSnap["kind"], MapPrefab> = {
  boar: spawnMapBoar,
};
