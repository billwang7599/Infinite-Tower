import type { FightEvent } from "@infinite-tower/shared/fight";
import type { BattleContext } from "../context.js";

/** After each step of the fight: shake the camera for what hit hard in it. */
export function shakeForImpacts(ctx: BattleContext, events: readonly FightEvent[]): void {
  for (const event of events) {
    const shake = event.type === "slam" ? 0.35 : event.team === "player" ? 0.15 + event.damage * 0.008 : 0.06;
    ctx.shake = Math.max(ctx.shake, shake);
  }
}
