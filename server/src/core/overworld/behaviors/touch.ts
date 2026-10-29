import { defineComponent, distXZ, type EnemyId, type System } from "@infinite-tower/shared";
import { OverworldPlayer, OverworldPos } from "../components.js";
import type { OverworldContext } from "../context.js";
import { part } from "../parts.js";
import { huntable } from "../player.js";

export interface EncounterOnTouchData { range: number; enemy: EnemyId }
export const EncounterOnTouch = defineComponent<EncounterOnTouchData>("EncounterOnTouch");

export const encounterOnTouch = (o: EncounterOnTouchData) => part(EncounterOnTouch, { ...o });

export function touchSystem(ctx: OverworldContext): System {
  return (world) => {
    for (const [player, walk, at] of world.query(OverworldPlayer, OverworldPos)) {
      if (!huntable(walk)) continue;
      for (const [e, touch, pos] of world.query(EncounterOnTouch, OverworldPos)) {
        if (distXZ(at, pos) < touch.range) {
          ctx.startEncounter(player, e, touch.enemy);
          break;
        }
      }
    }
  };
}
