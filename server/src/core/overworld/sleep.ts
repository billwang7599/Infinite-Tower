import { defineComponent, distXZ, type System, type Vec2 } from "@infinite-tower/shared";
import { OverworldActor, OverworldPlayer, OverworldPos } from "./components.js";

/** Twice the view's radius: whatever a player sees, or will in a few seconds, is about its business. */
export const AWAKE_TILES = 40;
/** Worked out this often, not every tick. */
const CHECK_TIME = 0.25;

/** Out of every walking player's reach: the behaviors skip it. */
export const Asleep = defineComponent<true>("Asleep");

export function sleepSystem(): System {
  let sinceCheck = Infinity;
  return (world, dt) => {
    if ((sinceCheck += dt) < CHECK_TIME) return;
    sinceCheck = 0;
    const walkers: Vec2[] = [];
    for (const [, walk, pos] of world.query(OverworldPlayer, OverworldPos)) if (!walk.fighting) walkers.push(pos);
    for (const [e, actor, pos] of world.query(OverworldActor, OverworldPos)) {
      const near = walkers.some((at) => distXZ(at, pos) <= AWAKE_TILES);
      if (near) world.remove(e, Asleep);
      else if (!world.has(e, Asleep)) {
        world.add(e, Asleep, true);
        actor.vx = actor.vz = 0;
      }
    }
  };
}
