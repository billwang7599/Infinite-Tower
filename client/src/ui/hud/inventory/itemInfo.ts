/** What the bag screen tells you about a stack: the lines of its tooltip. */
import { footprint, isWeapon, itemDef, type BagItem, type ItemEffect, type ItemId } from "@infinite-tower/shared";

const WIELDED = "In a hand: light and heavy attacks, and a guard.";
const HELD: Partial<Record<ItemId, string>> = { skillbook: "In a hand: quick-cast skills." };

export interface ItemInfo {
  /** With the count, for a stack of more than one. */
  name: string;
  /** Cells across × down, as it lies. */
  size: string;
  weight: string;
  /** What using it does; null for things that can't be used. */
  effect: string | null;
}

export const effectsText = (effects: readonly ItemEffect[]): string =>
  effects.map((effect) => `Heals ${effect.healHp} HP.`).join(" ");

/** One decimal place at most: "12", "12.5". */
export const formatWeight = (weight: number): string => String(Math.round(weight * 10) / 10);

export function itemInfo(stack: BagItem): ItemInfo {
  const def = itemDef(stack.item), use = def.consumable;
  const { cols, rows } = footprint(stack.item, stack.turned);
  const each = formatWeight(def.weight);
  const many = stack.count > 1;
  return {
    name: many ? `${def.name} ×${stack.count}` : def.name,
    size: `${cols} × ${rows}`,
    weight: many ? `${each} each, ${formatWeight(def.weight * stack.count)} in all` : each,
    effect: use ? `${effectsText(use.effects)} Takes ${use.useTime} s; a hit stops it.`
      : isWeapon(stack.item) ? WIELDED : HELD[stack.item] ?? null,
  };
}
