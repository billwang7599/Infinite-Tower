/** Encounter on touch: bumping into the player starts a fight against `enemy`. */
import { defineComponent, distXZ, type System } from "@infinite-tower/shared";
import type { EnemyId } from "../../content/enemies.js";
import { FieldPos } from "../components.js";
import { findPrey, type FieldContext } from "../context.js";
import { part } from "../parts.js";

export interface EncounterOnTouchData { range: number; enemy: EnemyId }
export const EncounterOnTouch = defineComponent<EncounterOnTouchData>("EncounterOnTouch");

export const encounterOnTouch = (o: EncounterOnTouchData) => part(EncounterOnTouch, { ...o });

export function touchSystem(ctx: FieldContext): System {
  return (world) => {
    const prey = findPrey(world);
    if (!prey || prey.safe) return;
    for (const [e, touch, pos] of world.query(EncounterOnTouch, FieldPos)) {
      if (distXZ(prey.pos, pos) < touch.range) {
        ctx.encounter(e, touch.enemy);
        return;
      }
    }
  };
}
