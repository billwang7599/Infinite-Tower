/**
 * How a fight ends. It's lost when no player is standing (dead, or gone: see LEAVING_LOSES), won when no enemy is,
 * and lost when it's still undecided after MAX_FIGHT_TIME. The two constants are choices, not physics: kept here so
 * they're easy to find and change.
 */
import type { System } from "../../core/ecs.js";
import { Fighter, Health } from "../components.js";
import type { FightOutcome, FightState } from "./context.js";

/** Seconds a fight may go on. Still undecided then, it's lost: a guard on the server's resources, not a clock. */
export const MAX_FIGHT_TIME = 10 * 60;

/**
 * A player who disconnects mid-fight (closes the tab, loses the connection, plays in another tab) is out of it, down
 * as if dead, and has lost it: their bag empties as on a death, so leaving can't escape one. Were it false, they'd
 * be out of it with nothing won or lost (the HP, stamina and bag they came in with).
 */
export const LEAVING_LOSES = true;

/** How a fight came out for one player: as it did for everyone, or "left" (gone, with LEAVING_LOSES off). */
export type PlayerResult = FightState | "left";

/** The fight's result for one player: the fight's own, except for a player who `left` it (LEAVING_LOSES). */
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
