/** The local player on the field: predicted position plus its sprite and the tall-grass tuft. */
import { LocalPlayer, type Entity, type Vec2, type World } from "@infinite-tower/shared";
import { FieldActor, FieldPos, FieldSprite } from "../components.js";
import type { FieldView } from "../scene.js";
import { flatSprite } from "./sprite.js";

export function spawnFieldPlayer(world: World, view: FieldView, at: Vec2): Entity {
  const e = world.spawn();
  world.add(e, LocalPlayer, true);
  world.add(e, FieldPos, { x: at.x, z: at.z });
  world.add(e, FieldActor, { vx: 0, vz: 0, facing: 1, alert: false, target: null });
  const tuft = flatSprite(view, "field-tuft", 1.1, view.materials.tuft);
  tuft.setEnabled(false);
  world.add(e, FieldSprite, { mesh: flatSprite(view, "field-player", 1.6, view.materials.player), alert: null, tuft, size: 1.6, walkPhase: 0 });
  return e;
}
