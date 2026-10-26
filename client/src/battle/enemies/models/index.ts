/**
 * Enemy models by EnemyDef.model. A model builds its meshes under the enemy's node (BodyNode) and adds its
 * own component, animates it with its own render system, and disposes it when the enemy is removed.
 * New look: add a folder next to boar/ and list it here.
 */
import type { TransformNode } from "@babylonjs/core";
import type { EnemyDef, Entity, System, World } from "@infinite-tower/shared";
import type { BattleContext } from "../../context.js";
import { boarAnimationSystem } from "./boar/animation.js";
import { addBoarModel, registerBoarDisposers } from "./boar/model.js";

export interface EnemyModel {
  /** Builds the model under `node` (which follows the body), facing `yaw`, and adds its component to `e` in `world`. */
  add(ctx: BattleContext, world: World, e: Entity, node: TransformNode, def: EnemyDef, yaw: number): void;
  /** Per render frame: pose the model from the enemy's state. */
  animation(): System;
  registerDisposers(world: World): void;
}

export const ENEMY_MODELS: Record<EnemyDef["model"], EnemyModel> = {
  boar: { add: addBoarModel, animation: boarAnimationSystem, registerDisposers: registerBoarDisposers },
};
