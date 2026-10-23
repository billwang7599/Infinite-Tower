/**
 * Building entities from parts. A behavior exports a factory that returns a Part (its component with
 * defaults filled in); a prefab is a list of parts. See prefabs/boar.ts.
 */
import type { ComponentType, Entity, Vec2, World } from "@infinite-tower/shared";
import { FieldActor, FieldPos, type FieldActorData } from "./components.js";

export interface Part { add(world: World, e: Entity): void }

export function part<T>(type: ComponentType<T>, data: T): Part {
  return { add: (world, e) => { world.add(e, type, data); } };
}

/** A field actor at `at`, drawn by the client prefab `kind`, with the given behaviors. */
export function spawnActor(world: World, kind: FieldActorData["kind"], at: Vec2, parts: Part[]): Entity {
  const e = world.spawn();
  world.add(e, FieldPos, { x: at.x, z: at.z });
  world.add(e, FieldActor, { kind, vx: 0, vz: 0, facing: -1, busy: false, alert: false });
  for (const p of parts) p.add(world, e);
  return e;
}
