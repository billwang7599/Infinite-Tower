import type { Entity, System, World } from "../../../core/ecs.js";
import { finishUse, stepUse } from "../../../items/using.js";
import { coreStats, type CoreState } from "../../../soul/core.js";
import { Health, Player, Stamina } from "../../components.js";
import { FighterStats, grownVitals, maxHpOf, STAT_KEYS, staminaMaxOf } from "../../stats.js";
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
      const target = { hp: health.hp, max: health.max, core: player.core };
      const bag = using && finishUse(using, player.gear.bag, target);
      if (!using || !bag) continue;
      player.gear = { ...player.gear, bag };
      health.hp = target.hp;
      const brokeThrough = target.core.steps > player.core.steps;
      takeCore(world, e, target.core);
      ctx.events.push({ type: "used", player: e, item: using.item, brokeThrough });
    }
  };
}

export function takeCore(world: World, e: Entity, core: CoreState): void {
  const player = world.require(e, Player), stats = world.require(e, FighterStats), was = { ...stats };
  const before = coreStats(player.core), after = coreStats(core);
  player.core = core;
  for (const stat of STAT_KEYS) stats[stat] += after[stat] - before[stat];
  const health = world.require(e, Health), stamina = world.require(e, Stamina);
  const vitals = grownVitals({ hp: health.hp, stamina: stamina.value }, was, stats);
  Object.assign(health, { hp: vitals.hp, max: maxHpOf(stats) });
  Object.assign(stamina, { value: vitals.stamina, max: staminaMaxOf(stats) });
}
