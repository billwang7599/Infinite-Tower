/** A bare field world for behavior tests: a player entity and a FieldContext that records encounters. */
import { World, type Entity, type Vec2 } from "@infinite-tower/shared";
import type { EnemyId } from "../../../src/core/content/enemies.js";
import { FieldActor, FieldPlayer, FieldPos } from "../../../src/core/field/components.js";
import type { FieldContext } from "../../../src/core/field/context.js";
import type { LevelDef } from "../../../src/core/levels/level.js";
import { TEST_LEVEL } from "../../fixtures/level.js";

export interface Encounter { source: Entity | null; enemy: EnemyId }

export interface TestField {
  world: World;
  player: Entity;
  ctx: FieldContext;
  encounters: Encounter[];
}

export function testField(o: { playerAt?: Vec2; rng?: () => number; level?: LevelDef } = {}): TestField {
  const world = new World();
  const encounters: Encounter[] = [];
  const player = world.spawn();
  const at = o.playerAt ?? { x: 0, z: 0 };
  world.add(player, FieldPos, { x: at.x, z: at.z });
  world.add(player, FieldPlayer, { queue: [], credits: 0, ack: 0, grassDist: 0, safeTime: 0 });
  const ctx: FieldContext = {
    level: o.level ?? TEST_LEVEL,
    rng: o.rng ?? (() => 0),
    startEncounter: (source, enemy) => { encounters.push({ source, enemy }); },
  };
  return { world, player, ctx, encounters };
}

export function pos(world: World, e: Entity): Vec2 {
  return world.require(e, FieldPos);
}

export function actors(world: World): Entity[] {
  return [...world.query(FieldActor)].map(([e]) => e);
}
