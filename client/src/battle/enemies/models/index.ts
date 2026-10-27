/** Enemy models by EnemyDef.model: each builds its meshes under the enemy's node and animates them from its state. */
import type { TransformNode } from "@babylonjs/core";
import type { EnemyDef, Entity, System, World } from "@infinite-tower/shared";
import type { BattleContext } from "../../context.js";
import { boarAnimationSystem } from "./boar/animation.js";
import { addBoarModel, registerBoarDisposers } from "./boar/model.js";
import { koboldAnimationSystem } from "./kobold/animation.js";
import { addKoboldModel, registerKoboldDisposers } from "./kobold/model.js";

export interface EnemyModel {
  /** Builds the model under `node` (which follows the body), facing `yaw`, and adds its component to `e` in `world`. */
  add(ctx: BattleContext, world: World, e: Entity, node: TransformNode, def: EnemyDef, yaw: number): void;
  /** Per render frame: pose the model from the enemy's state. */
  animation(): System;
  registerDisposers(world: World): void;
}

export const ENEMY_MODELS: Record<EnemyDef["model"], EnemyModel> = {
  boar: { add: addBoarModel, animation: boarAnimationSystem, registerDisposers: registerBoarDisposers },
  kobold: { add: addKoboldModel, animation: koboldAnimationSystem, registerDisposers: registerKoboldDisposers },
};
