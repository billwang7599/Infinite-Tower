/** The local player on the field: predicted position plus its sprite and the tall-grass tuft. */
import type { Entity, Vec2, World } from "@infinite-tower/shared";
import { MapActor, MapPos, MapSprite } from "../components.js";
import type { MapView } from "../scene.js";
import { flatSprite } from "./sprite.js";

export function spawnMapPlayer(world: World, view: MapView, at: Vec2): Entity {
  const e = world.spawn();
  world.add(e, MapPos, { x: at.x, z: at.z });
  world.add(e, MapActor, { kind: "player", vx: 0, vz: 0, facing: 1, alert: false, target: null });
  const tuft = flatSprite(view, "map-tuft", 1.1, view.materials.tuft);
  tuft.setEnabled(false);
  world.add(e, MapSprite, { mesh: flatSprite(view, "map-player", 1.6, view.materials.player), alert: null, tuft, size: 1.6, walkPhase: 0 });
  return e;
}
