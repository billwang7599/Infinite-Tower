/** A field boar as the server reports it: glides to the server's position, shows "!" when it notices you. */
import type { Entity, Vec2, World } from "@infinite-tower/shared";
import type { FieldView } from "../scene.js";
import { spawnFieldActor } from "./actor.js";

export function spawnFieldBoar(world: World, view: FieldView, at: Vec2): Entity {
  return spawnFieldActor(world, view, at, {
    name: "field-boar", material: view.materials.boar, sizeTiles: 2, facing: -1, glide: true,
    alert: view.materials.alert,
  });
}
