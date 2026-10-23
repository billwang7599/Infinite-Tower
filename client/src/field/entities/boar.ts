/** A field boar as the server reports it: glides to the server's position, shows "!" when it notices you. */
import type { Entity, Vec2, World } from "@infinite-tower/shared";
import { FieldActor, FieldPos, FieldSprite } from "../components.js";
import type { FieldView } from "../scene.js";
import { flatSprite } from "./sprite.js";

export function spawnFieldBoar(world: World, view: FieldView, at: Vec2): Entity {
  const e = world.spawn();
  world.add(e, FieldPos, { x: at.x, z: at.z });
  world.add(e, FieldActor, { vx: 0, vz: 0, facing: -1, alert: false, target: { x: at.x, z: at.z } });
  const alert = flatSprite(view, "field-alert", 0.9, view.materials.alert);
  alert.setEnabled(false);
  world.add(e, FieldSprite, { mesh: flatSprite(view, "field-boar", 2.0, view.materials.boar), alert, tuft: null, size: 2.0, walkPhase: 0 });
  return e;
}
