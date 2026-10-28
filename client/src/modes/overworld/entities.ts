/** What every drawn overworld actor is made of (a position, the actor data, its sprite quad), and each kind's. */
import type { Mesh, StandardMaterial } from "@babylonjs/core";
import { LocalPlayer, type ActorSnap, type Entity, type Vec2, type World } from "@infinite-tower/shared";
import type { ChibiFacing } from "../../gfx/look/look.js";
import { OverworldActor, OverworldPos, OverworldSprite } from "./components.js";
import type { Facing } from "./facing.js";
import { flatSprite, type OverworldView } from "./scene.js";

interface OverworldActorSpec {
  name: string;
  material: StandardMaterial;
  /** A picture per way it faces (OverworldSprite.facings), for the player's chibi. */
  facings?: Record<ChibiFacing, StandardMaterial>;
  sizeTiles: number;
  facing: Facing;
  /** Glides toward the server's position (false for the predicted local player). */
  glide: boolean;
  /** "!" bubble, shown when the actor notices you. */
  alert?: StandardMaterial;
  /** Grass drawn over the feet in tall grass. */
  tuft?: StandardMaterial;
}

function spawnOverworldActor(world: World, view: OverworldView, at: Vec2, spec: OverworldActorSpec): Entity {
  const e = world.spawn();
  world.add(e, OverworldPos, { x: at.x, z: at.z });
  world.add(e, OverworldActor, {
    vx: 0, vz: 0, facing: spec.facing, alert: false, target: spec.glide ? { x: at.x, z: at.z } : null,
  });
  world.add(e, OverworldSprite, {
    mesh: flatSprite(view, spec.name, spec.sizeTiles, spec.material),
    facings: spec.facings ?? null,
    alert: spec.alert ? hidden(flatSprite(view, "overworld-alert", 0.9, spec.alert)) : null,
    tuft: spec.tuft ? hidden(flatSprite(view, "overworld-tuft", 1.1, spec.tuft)) : null,
    size: spec.sizeTiles,
    walkPhase: 0,
  });
  return e;
}

function hidden(mesh: Mesh): Mesh {
  mesh.setEnabled(false);
  return mesh;
}

type OverworldPrefab = (world: World, view: OverworldView, at: Vec2) => Entity;

/** How to draw each kind of server actor (ActorSnap.kind). */
export const OVERWORLD_PREFABS: Record<ActorSnap["kind"], OverworldPrefab> = {
  boar: (world, view, at) => spawnOverworldActor(world, view, at, {
    name: "overworld-boar", material: view.materials.boar, sizeTiles: 2, facing: "left", glide: true,
    alert: view.materials.alert,
  }),
  kobold: (world, view, at) => spawnOverworldActor(world, view, at, {
    name: "overworld-kobold", material: view.materials.kobold, sizeTiles: 1.6, facing: "right", glide: true,
    alert: view.materials.alert,
  }),
};

/** The local player: predicted, with the tall-grass tuft. */
export function spawnOverworldPlayer(world: World, view: OverworldView, at: Vec2): Entity {
  const e = spawnOverworldActor(world, view, at, {
    name: "overworld-player", material: view.materials.player.front, facings: view.materials.player,
    sizeTiles: 1.6, facing: "down", glide: false, tuft: view.materials.tuft,
  });
  world.add(e, LocalPlayer, true);
  return e;
}
