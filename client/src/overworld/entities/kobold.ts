/** An overworld kobold as the server reports it: glides to the server's position, shows "!" when it notices you. */
import type { Entity, Vec2, World } from "@infinite-tower/shared";
import type { OverworldView } from "../scene.js";
import { spawnOverworldActor } from "./actor.js";

export function spawnOverworldKobold(world: World, view: OverworldView, at: Vec2): Entity {
  return spawnOverworldActor(world, view, at, {
    name: "overworld-kobold", material: view.materials.kobold, sizeTiles: 1.6, facing: "right", glide: true,
    alert: view.materials.alert,
  });
}
