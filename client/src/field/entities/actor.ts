/** What every drawn field actor is made of: a position, the actor data, and its sprite quad. */
import type { Mesh, StandardMaterial } from "@babylonjs/core";
import type { Entity, Vec2, World } from "@infinite-tower/shared";
import { FieldActor, FieldPos, FieldSprite } from "../components.js";
import { flatSprite, type FieldView } from "../scene.js";

interface FieldActorSpec {
  name: string;
  material: StandardMaterial;
  sizeTiles: number;
  facing: 1 | -1;
  /** Glides toward the server's position (false for the predicted local player). */
  glide: boolean;
  /** "!" bubble, shown when the actor notices you. */
  alert?: StandardMaterial;
  /** Grass drawn over the feet in tall grass. */
  tuft?: StandardMaterial;
}

export function spawnFieldActor(world: World, view: FieldView, at: Vec2, spec: FieldActorSpec): Entity {
  const e = world.spawn();
  world.add(e, FieldPos, { x: at.x, z: at.z });
  world.add(e, FieldActor, {
    vx: 0, vz: 0, facing: spec.facing, alert: false, target: spec.glide ? { x: at.x, z: at.z } : null,
  });
  world.add(e, FieldSprite, {
    mesh: flatSprite(view, spec.name, spec.sizeTiles, spec.material),
    alert: spec.alert ? hidden(flatSprite(view, "field-alert", 0.9, spec.alert)) : null,
    tuft: spec.tuft ? hidden(flatSprite(view, "field-tuft", 1.1, spec.tuft)) : null,
    size: spec.sizeTiles,
    walkPhase: 0,
  });
  return e;
}

function hidden(mesh: Mesh): Mesh {
  mesh.setEnabled(false);
  return mesh;
}
