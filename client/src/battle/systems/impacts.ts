import type { BattleEvent } from "@infinite-tower/shared";
import type { BattleContext } from "../context.js";

/** As the server's state comes: shake the camera for what hit hard since the last one. */
export function shakeForImpacts(ctx: BattleContext, events: readonly BattleEvent[]): void {
  for (const event of events) {
    const shake = event.type === "slam" ? 0.35 : event.team === "player" ? 0.15 + event.damage * 0.008 : 0.06;
    ctx.shake = Math.max(ctx.shake, shake);
  }
}
