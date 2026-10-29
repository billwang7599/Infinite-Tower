/**
 * How a fight ends: lost when no player stands, won when no enemy does, lost after MAX_FIGHT_TIME. A duel is won
 * when one player is left standing, and lost (by both) when none is, or at the time limit.
 */
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

/** `duelist`: in a duel, whether this player is still standing. Leaving a duel forfeits it, with nothing lost. */
export function playerResult(outcome: FightOutcome, left: boolean, duelist?: { standing: boolean }): PlayerResult {
  if (left) return LEAVING_LOSES && !duelist ? "lost" : "left";
  if (!duelist || outcome.state === "fighting") return outcome.state;
  return outcome.state === "won" && duelist.standing ? "won" : "lost";
}

/** After combat: decide the fight and time its state. */
export function outcomeSystem(outcome: FightOutcome, duel: boolean): System {
  return (world, dt) => {
    outcome.stateTime += dt;
    if (outcome.state !== "fighting") return;
    let playersUp = 0, enemiesUp = false;
    for (const [, f, h] of world.query(Fighter, Health)) {
      if (h.hp <= 0) continue;
      if (f.team === "player") playersUp++;
      else enemiesUp = true;
    }
    if (playersUp === 0 || outcome.stateTime >= MAX_FIGHT_TIME) Object.assign(outcome, { state: "lost", stateTime: 0 });
    else if (duel ? playersUp === 1 : !enemiesUp) Object.assign(outcome, { state: "won", stateTime: 0 });
  };
}
