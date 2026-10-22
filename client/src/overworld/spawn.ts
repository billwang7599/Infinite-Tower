/** Overworld entity factories: rules data (shared) plus a flat sprite to draw it. */
import { MeshBuilder, type Mesh, type StandardMaterial } from "@babylonjs/core";
import { MapBoar, MapPlayer, MapPos, PlayerInput, type Entity, type Vec2, type World } from "@infinite-tower/shared";
import { MapSprite } from "./components.js";
import type { MapView } from "./scene.js";

function flatSprite(view: MapView, name: string, size: number, material: StandardMaterial): Mesh {
  const m = MeshBuilder.CreatePlane(name, { size }, view.scene);
  m.rotation.x = Math.PI / 2; // lie flat, top of the sprite toward +z (up on screen)
  m.material = material;
  return m;
}

export function spawnMapPlayer(world: World, view: MapView, at: Vec2): Entity {
  const e = world.spawn();
  world.add(e, MapPos, { x: at.x, z: at.z });
  world.add(e, MapPlayer, { vx: 0, vz: 0, facing: 1, grassDist: 0, safeTime: 0 });
  world.add(e, PlayerInput, { moveX: 0, moveZ: 0, aimX: 0, aimZ: 1, jump: false, attack: false, dodge: false });
  const tuft = flatSprite(view, "map-tuft", 1.1, view.materials.tuft);
  tuft.setEnabled(false);
  world.add(e, MapSprite, { mesh: flatSprite(view, "map-player", 1.6, view.materials.player), alert: null, tuft, size: 1.6, walkPhase: 0 });
  return e;
}

export function spawnMapBoar(world: World, view: MapView, at: Vec2): Entity {
  const e = world.spawn();
  world.add(e, MapPos, { x: at.x, z: at.z });
  world.add(e, MapBoar, { state: "idle", t: 0, duration: 1, tx: at.x, tz: at.z, vx: 0, vz: 0, facing: -1 });
  const alert = flatSprite(view, "map-alert", 0.9, view.materials.alert);
  alert.setEnabled(false);
  world.add(e, MapSprite, { mesh: flatSprite(view, "map-boar", 2.0, view.materials.boar), alert, tuft: null, size: 2.0, walkPhase: 0 });
  return e;
}
