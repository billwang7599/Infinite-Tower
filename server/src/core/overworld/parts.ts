/** A behavior's factory returns a Part (its component, defaults filled in); an actor is a list of parts. */
import type { ComponentType, Entity, Vec2, World } from "@infinite-tower/shared";
import { OverworldActor, OverworldPos, type OverworldActorData } from "./components.js";

export type Part = (world: World, e: Entity) => void;

export function part<T>(type: ComponentType<T>, data: T): Part {
  return (world, e) => { world.add(e, type, data); };
}

export function spawnActor(world: World, kind: OverworldActorData["kind"], at: Vec2, parts: Part[]): Entity {
  const e = world.spawn();
  world.add(e, OverworldPos, { x: at.x, z: at.z });
  world.add(e, OverworldActor, { kind, vx: 0, vz: 0, facing: -1, busy: false, alert: false });
  for (const addPart of parts) addPart(world, e);
  return e;
}
