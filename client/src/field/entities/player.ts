/** The local player on the field: predicted position plus its sprite and the tall-grass tuft. */
import { LocalPlayer, type Entity, type Vec2, type World } from "@infinite-tower/shared";
import type { FieldView } from "../scene.js";
import { spawnFieldActor } from "./actor.js";

export function spawnFieldPlayer(world: World, view: FieldView, at: Vec2): Entity {
  const e = spawnFieldActor(world, view, at, {
    name: "field-player", material: view.materials.player.front, turns: view.materials.player,
    sizeTiles: 1.6, facing: "down", glide: false, tuft: view.materials.tuft,
  });
  world.add(e, LocalPlayer, true);
  return e;
}
