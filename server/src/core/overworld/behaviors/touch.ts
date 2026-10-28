/** Encounter on touch: bumping into the player starts a fight against `enemy`. */
import { defineComponent, distXZ, type EnemyId, type System } from "@infinite-tower/shared";
import { OverworldPos } from "../components.js";
import type { OverworldContext } from "../context.js";
import { part } from "../parts.js";
import { findPlayer } from "../player.js";

export interface EncounterOnTouchData { range: number; enemy: EnemyId }
export const EncounterOnTouch = defineComponent<EncounterOnTouchData>("EncounterOnTouch");

export const encounterOnTouch = (o: EncounterOnTouchData) => part(EncounterOnTouch, { ...o });

export function touchSystem(ctx: OverworldContext): System {
  return (world) => {
    const player = findPlayer(world);
    if (!player || player.safe) return;
    for (const [e, touch, pos] of world.query(EncounterOnTouch, OverworldPos)) {
      if (distXZ(player.pos, pos) < touch.range) {
        ctx.startEncounter(e, touch.enemy);
        return;
      }
    }
  };
}
