import type { System } from "../../../core/ecs.js";
import { Body, Player, type BodyData, type PlayerData } from "../../components.js";
import { PLAYER } from "../../player.js";
import type { ArenaPhysics } from "../physics/arena-physics.js";

/** How far below the feet a ray still finds the floor. */
const GROUND_PROBE = 0.08;
/** Rising faster than this (m/s), a player isn't on the ground, whatever is under their feet. */
const MAX_GROUNDED_RISE = 0.5;

/** How far from the feet's middle the other rays start (m). */
const RAY_SPREAD = PLAYER.radius * 0.7;
const RAY_OFFSETS = [[0, 0], [RAY_SPREAD, 0], [-RAY_SPREAD, 0], [0, RAY_SPREAD], [0, -RAY_SPREAD]] as const;

/** After each physics step: cast a few short rays down from the feet to decide `grounded`. */
export function playerGroundSystem(physics: ArenaPhysics): System {
  return (world, dt) => {
    for (const [, player, body] of world.query(Player, Body)) groundPlayer(physics, player, body, dt);
  };
}

/** One player's `grounded` and `airTime` after a physics step (the system above, or the client's prediction). */
export function groundPlayer(physics: ArenaPhysics, player: PlayerData, body: BodyData, dt: number): void {
  const p = body.pos, reach = body.centerHeight + GROUND_PROBE;
  const grounded = body.vel.y <= MAX_GROUNDED_RISE
    && RAY_OFFSETS.some(([ox, oz]) => physics.floorBelow(p.x + ox, p.y, p.z + oz, reach) !== null);
  player.grounded = grounded;
  player.airTime = grounded ? 0 : player.airTime + dt;
}
