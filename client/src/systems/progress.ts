import { Player, PLAYER, floorAtHeight, type System } from "@infinite-tower/shared";
import { Body } from "../components.js";
import type { GameContext } from "../context.js";
import { teleport } from "../spawn.js";

/** Floors reached, checkpoints every 10 floors, and respawning after a long fall. */
export function progressSystem(ctx: GameContext): System {
  return (world) => {
    for (const [e, player, body] of world.query(Player, Body)) {
      const p = body.mesh.position;
      const feetY = p.y - PLAYER.height / 2;

      if (player.grounded) {
        const floor = floorAtHeight(feetY);
        if (floor > player.bestFloor) player.bestFloor = floor;
        if (floor > 0 && floor % 10 === 0 && floor > floorAtHeight(player.spawnPoint.y)) {
          player.spawnPoint = { x: p.x, y: feetY, z: p.z };
        }
      }

      if (feetY < player.spawnPoint.y - 8) {
        teleport(ctx, e, { ...player.spawnPoint, y: player.spawnPoint.y + 0.5 });
      }
    }
  };
}
