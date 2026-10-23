/**
 * Enemy models by EnemyDef.model. A model builds its meshes under the physics collider and adds its
 * own view component (animated by its own render system). New look: add a file here and list it.
 */
import type { Mesh } from "@babylonjs/core";
import type { EnemyDef, Entity } from "@infinite-tower/shared";
import type { GameContext } from "../../context.js";
import { addBoarModel } from "./boar.js";

export type EnemyModel = (ctx: GameContext, e: Entity, collider: Mesh, def: EnemyDef, yaw: number) => void;

export const ENEMY_MODELS: Record<EnemyDef["model"], EnemyModel> = {
  boar: addBoarModel,
};
