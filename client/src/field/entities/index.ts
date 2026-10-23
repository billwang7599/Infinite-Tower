/** How to draw each kind of server actor (ActorSnap.kind). New actor kind: add a file here and list it. */
import type { ActorSnap, Entity, Vec2, World } from "@infinite-tower/shared";
import type { FieldView } from "../scene.js";
import { spawnFieldBoar } from "./boar.js";

export type FieldPrefab = (world: World, view: FieldView, at: Vec2) => Entity;

export const FIELD_PREFABS: Record<ActorSnap["kind"], FieldPrefab> = {
  boar: spawnFieldBoar,
};
