import type { System } from "../../../core/ecs.js";
import { Body, Player } from "../../components.js";
import { PLAYER } from "../../player.js";
import type { ArenaPhysics } from "../physics/arena-physics.js";

/** How far below the feet a ray still finds the floor. */
const GROUND_PROBE = 0.08;
/** Rising faster than this (m/s), a player isn't on the ground, whatever is under their feet. */
const MAX_GROUNDED_RISE = 0.5;

/** After each physics step: cast a few short rays down from the feet to decide `grounded`. */
export function playerGroundSystem(physics: ArenaPhysics): System {
  const r = PLAYER.radius * 0.7;
  const offsets = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]] as const;

  return (world, dt) => {
    for (const [, player, body] of world.query(Player, Body)) {
      const p = body.pos, reach = body.centerHeight + GROUND_PROBE;
      const grounded = body.vel.y <= MAX_GROUNDED_RISE
        && offsets.some(([ox, oz]) => physics.floorBelow(p.x + ox, p.y, p.z + oz, reach) !== null);
      player.grounded = grounded;
      player.airTime = grounded ? 0 : player.airTime + dt;
    }
  };
}
