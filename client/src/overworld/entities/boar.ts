/** An overworld boar as the server reports it: glides to the server's position, shows "!" when it notices you. */
import type { Entity, Vec2, World } from "@infinite-tower/shared";
import type { OverworldView } from "../scene.js";
import { spawnOverworldActor } from "./actor.js";

export function spawnOverworldBoar(world: World, view: OverworldView, at: Vec2): Entity {
  return spawnOverworldActor(world, view, at, {
    name: "overworld-boar", material: view.materials.boar, sizeTiles: 2, facing: "left", glide: true,
    alert: view.materials.alert,
  });
}
