/** What every drawn overworld actor is made of: a position, the actor data, and its sprite quad. */
import type { Mesh, StandardMaterial } from "@babylonjs/core";
import type { Entity, Vec2, World } from "@infinite-tower/shared";
import type { ChibiFacing } from "../../gfx/look/look.js";
import { OverworldActor, OverworldPos, OverworldSprite } from "../components.js";
import type { Facing } from "../facing.js";
import { flatSprite, type OverworldView } from "../scene.js";

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

export function spawnOverworldActor(world: World, view: OverworldView, at: Vec2, spec: OverworldActorSpec): Entity {
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
