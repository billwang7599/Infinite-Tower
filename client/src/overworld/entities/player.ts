/** The local player on the overworld: predicted position plus its sprite and the tall-grass tuft. */
import { LocalPlayer, type Entity, type Vec2, type World } from "@infinite-tower/shared";
import type { OverworldView } from "../scene.js";
import { spawnOverworldActor } from "./actor.js";

export function spawnOverworldPlayer(world: World, view: OverworldView, at: Vec2): Entity {
  const e = spawnOverworldActor(world, view, at, {
    name: "overworld-player", material: view.materials.player.front, facings: view.materials.player,
    sizeTiles: 1.6, facing: "down", glide: false, tuft: view.materials.tuft,
  });
  world.add(e, LocalPlayer, true);
  return e;
}
