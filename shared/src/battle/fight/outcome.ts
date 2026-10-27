import type { System } from "../../core/ecs.js";
import { Fighter, Health } from "../components.js";
import type { FightOutcome } from "./context.js";

/** After combat: decide the fight (lost when no player stands, won when no enemy does) and time its state. */
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
    if (!playersUp) Object.assign(outcome, { state: "lost", stateTime: 0 });
    else if (!enemiesUp) Object.assign(outcome, { state: "won", stateTime: 0 });
  };
}
