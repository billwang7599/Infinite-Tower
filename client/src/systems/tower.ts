import { Player, TOWER, floorAtHeight, type Entity, type System } from "@infinite-tower/shared";
import type { GameContext } from "../context.js";
import { spawnFloor } from "../spawn.js";

/**
 * Streams the infinite tower: keeps floors from just below the lowest checkpoint
 * up to a few floors above the highest player, across all players.
 */
export function towerSystem(ctx: GameContext): System {
  const floors = new Map<number, Entity[]>();

  return (world) => {
    let low = Infinity, high = 0;
    for (const [, player] of world.query(Player)) {
      low = Math.min(low, floorAtHeight(player.spawnPoint.y) - 2);
      high = Math.max(high, player.bestFloor + TOWER.floorsAhead);
    }
    if (low === Infinity) return;
    low = Math.max(0, low);

    for (let f = low; f <= high; f++) {
      if (!floors.has(f)) floors.set(f, spawnFloor(ctx, f));
    }
    for (const [f, entities] of floors) {
      if (f < low || f > high) {
        for (const e of entities) world.destroy(e);
        floors.delete(f);
      }
    }
  };
}
