/** How a fight ends: lost when no player stands, won when no enemy does, lost after MAX_FIGHT_TIME. */
import type { System } from "../../core/ecs.js";
import { Fighter, Health } from "../components.js";
import type { FightOutcome, FightState } from "./context.js";

/** Seconds a fight may go on: a guard on the server's resources. */
export const MAX_FIGHT_TIME = 10 * 60;

/**
 * A player who disconnects mid-fight is down as if dead and has lost it (the bag empties), so leaving can't escape a
 * death. Were it false, they'd leave with what they came in with.
 */
export const LEAVING_LOSES = true;

/** "left": gone, with LEAVING_LOSES off. */
export type PlayerResult = FightState | "left";

export function playerResult(outcome: FightOutcome, left: boolean): PlayerResult {
  if (left) return LEAVING_LOSES ? "lost" : "left";
  return outcome.state;
}

/** After combat: decide the fight and time its state. */
export function outcomeSystem(outcome: FightOutcome): System {
  return (world, dt) => {
    outcome.stateTime += dt;
    if (outcome.state !== "fighting") return;
    let playersUp = false, enemiesUp = false;
    for (const [, f, h] of world.query(Fighter, Health)) {
      if (h.hp <= 0) continue;
      if (f.team === "player") playersUp = true;
      else enemiesUp = true;
    }
    if (!playersUp || outcome.stateTime >= MAX_FIGHT_TIME) Object.assign(outcome, { state: "lost", stateTime: 0 });
    else if (!enemiesUp) Object.assign(outcome, { state: "won", stateTime: 0 });
  };
}
