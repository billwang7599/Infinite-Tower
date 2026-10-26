/**
 * An arena enemy's drawing, on the fight's enemy entity (the fight built the enemy itself from its def): a node that
 * follows its body, and the model its def names, which animates from the enemy's state.
 */
import { TransformNode } from "@babylonjs/core";
import { Body, Enemy, type Entity, type World } from "@infinite-tower/shared";
import { BodyNode } from "../components.js";
import type { BattleContext } from "../context.js";
import { ENEMY_MODELS } from "./models/index.js";

/** Draws the fight's enemy `e` (in the fight's `world`). */
export function addEnemyModel(ctx: BattleContext, world: World, e: Entity): void {
  const node = new TransformNode(`enemy-${e}`, ctx.scene);
  const at = world.require(e, Body).pos;
  node.position.set(at.x, at.y, at.z);
  world.add(e, BodyNode, { node });
  const enemy = world.require(e, Enemy);
  ENEMY_MODELS[enemy.def.model].add(ctx, world, e, node, enemy.def, enemy.yaw);
}
