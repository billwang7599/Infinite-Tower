import { FIXED_DT } from "../core/time.js";
import { absorb, coreWhole, type CoreState } from "../soul/core.js";
import { itemAt, takeOne, type Bag } from "./bag.js";
import type { UseSpot } from "./gear.js";
import { itemDef, type ItemEffect, type ItemId } from "./items.js";

export interface Using { at: UseSpot; item: ItemId; stepsLeft: number }
export interface UseTarget { hp: number; max: number; core: CoreState }

// Whole FIXED_DT steps, as the fight and the overworld both step by them.
export const useSteps = (item: ItemId): number => Math.round((itemDef(item).consumable?.useTime ?? 0) / FIXED_DT);

// True if any of them did something.
function applyEffects(effects: readonly ItemEffect[], target: UseTarget): boolean {
  let worked = false;
  for (const effect of effects) {
    if ("healShare" in effect && target.hp < target.max) {
      target.hp = Math.min(target.max, target.hp + effect.healShare * target.max);
      worked = true;
    } else if ("essence" in effect && !coreWhole(target.core)) {
      target.core = absorb(target.core, effect.essence);
      worked = true;
    }
  }
  return worked;
}

export function startUse(grid: Bag, at: UseSpot, target: UseTarget): Using | null {
  const item = grid.items[itemAt(grid, at)]?.item;
  const effects = item && itemDef(item).consumable?.effects;
  return item && effects && applyEffects(effects, { ...target }) ? { at, item, stepsLeft: useSteps(item) } : null;
}

export const stepUse = (using: Using): Using => ({ ...using, stepsLeft: using.stepsLeft - 1 });

// Changes `target`; null (nothing used) if the item was moved or is gone.
export function finishUse(using: Using, grid: Bag, target: UseTarget): Bag | null {
  const left = grid.items[itemAt(grid, using.at)]?.item === using.item ? takeOne(grid, using.at) : null;
  if (left) applyEffects(itemDef(using.item).consumable?.effects ?? [], target);
  return left;
}
