import { Fighter, Health, LocalPlayer, type System } from "@infinite-tower/shared";
import type { BattleContext } from "../context.js";

/** After combat: decide the fight (lost when the player is down, won when no enemy stands) and time its state. */
export function outcomeSystem(ctx: BattleContext): System {
  return (world, dt) => {
    const fight = ctx.fight;
    fight.stateTime += dt;
    if (fight.state !== "fighting") return;
    const me = world.first(LocalPlayer, Health);
    let enemiesLeft = false;
    for (const [, f, h] of world.query(Fighter, Health)) if (f.team === "enemy" && h.hp > 0) enemiesLeft = true;
    if (me && me[2].hp <= 0) { fight.state = "lost"; fight.stateTime = 0; }
    else if (!enemiesLeft) { fight.state = "won"; fight.stateTime = 0; }
  };
}
