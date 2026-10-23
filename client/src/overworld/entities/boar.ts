/** A field boar as the server reports it: glides to the server's position, shows "!" when it notices you. */
import type { Entity, Vec2, World } from "@infinite-tower/shared";
import { MapActor, MapPos, MapSprite } from "../components.js";
import type { MapView } from "../scene.js";
import { flatSprite } from "./sprite.js";

export function spawnMapBoar(world: World, view: MapView, at: Vec2): Entity {
  const e = world.spawn();
  world.add(e, MapPos, { x: at.x, z: at.z });
  world.add(e, MapActor, { kind: "boar", vx: 0, vz: 0, facing: -1, alert: false, target: { x: at.x, z: at.z } });
  const alert = flatSprite(view, "map-alert", 0.9, view.materials.alert);
  alert.setEnabled(false);
  world.add(e, MapSprite, { mesh: flatSprite(view, "map-boar", 2.0, view.materials.boar), alert, tuft: null, size: 2.0, walkPhase: 0 });
  return e;
}
