import type { System } from "../../../core/ecs.js";
import { finishUse, stepUse } from "../../../items/using.js";
import { Health, Player } from "../../components.js";
import type { FightContext } from "../context.js";

// Runs after the step's hits: one that lands on the user stops it, nothing used.
export function useSystem(ctx: FightContext): System {
  return (world) => {
    for (const [e, player, health] of world.query(Player, Health)) {
      if (player.action !== "use" || !player.using) continue;
      const hit = ctx.events.some((event) => event.type === "hit" && event.target === e);
      const using = hit ? null : stepUse(player.using);
      if (using && using.stepsLeft > 0) {
        player.using = using;
        continue;
      }
      Object.assign(player, { action: "bag", actionTime: 0, using: null });
      const bag = using && finishUse(using, player.gear.bag, health);
      if (!using || !bag) continue;
      player.gear = { ...player.gear, bag };
      ctx.events.push({ type: "used", player: e, item: using.item });
    }
  };
}
