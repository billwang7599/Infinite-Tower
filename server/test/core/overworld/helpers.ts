/** A bare overworld ECS world for behavior tests: a player entity and an OverworldContext that records encounters. */
import { World, type EnemyId, type Entity, type Vec2 } from "@infinite-tower/shared";
import { OverworldActor, OverworldPlayer, OverworldPos } from "../../../src/core/overworld/components.js";
import { newWalk } from "../../../src/core/overworld/player.js";
import type { OverworldContext } from "../../../src/core/overworld/context.js";
import type { WorldDef } from "../../../src/core/world/world.js";
import { TEST_CHARACTER, TEST_WORLD } from "../../fixtures/world.js";

interface Encounter { player: Entity; source: Entity | null; enemy: EnemyId }

export interface TestOverworld {
  world: World;
  player: Entity;
  ctx: OverworldContext;
  encounters: Encounter[];
}

export function testOverworld(o: { playerAt?: Vec2; rng?: () => number; map?: WorldDef } = {}): TestOverworld {
  const world = new World();
  const encounters: Encounter[] = [];
  const player = world.spawn();
  const at = o.playerAt ?? { x: 0, z: 0 };
  world.add(player, OverworldPos, { x: at.x, z: at.z });
  world.add(player, OverworldPlayer, newWalk(TEST_CHARACTER));
  const ctx: OverworldContext = {
    map: o.map ?? TEST_WORLD,
    rng: o.rng ?? (() => 0),
    startEncounter: (p, source, enemy) => {
      world.require(p, OverworldPlayer).fighting = true;
      encounters.push({ player: p, source, enemy });
    },
  };
  return { world, player, ctx, encounters };
}

export function pos(world: World, e: Entity): Vec2 {
  return world.require(e, OverworldPos);
}

export function actors(world: World): Entity[] {
  return [...world.query(OverworldActor)].map(([e]) => e);
}
