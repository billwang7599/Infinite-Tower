/** A bare overworld ECS world for behavior tests: a player entity and an OverworldContext that records encounters. */
import { World, type Entity, type Vec2 } from "@infinite-tower/shared";
import type { EnemyId } from "../../../src/core/content/enemies.js";
import { OverworldActor, OverworldPlayer, OverworldPos } from "../../../src/core/overworld/components.js";
import type { OverworldContext } from "../../../src/core/overworld/context.js";
import type { LevelDef } from "../../../src/core/levels/level.js";
import { TEST_LEVEL } from "../../fixtures/level.js";

export interface Encounter { source: Entity | null; enemy: EnemyId }

export interface TestOverworld {
  world: World;
  player: Entity;
  ctx: OverworldContext;
  encounters: Encounter[];
}

export function testOverworld(o: { playerAt?: Vec2; rng?: () => number; level?: LevelDef } = {}): TestOverworld {
  const world = new World();
  const encounters: Encounter[] = [];
  const player = world.spawn();
  const at = o.playerAt ?? { x: 0, z: 0 };
  world.add(player, OverworldPos, { x: at.x, z: at.z });
  world.add(player, OverworldPlayer, { queue: [], credits: 0, ack: 0, grassDist: 0, safeTime: 0, pace: 1 });
  const ctx: OverworldContext = {
    level: o.level ?? TEST_LEVEL,
    rng: o.rng ?? (() => 0),
    startEncounter: (source, enemy) => { encounters.push({ source, enemy }); },
  };
  return { world, player, ctx, encounters };
}

export function pos(world: World, e: Entity): Vec2 {
  return world.require(e, OverworldPos);
}

export function actors(world: World): Entity[] {
  return [...world.query(OverworldActor)].map(([e]) => e);
}
