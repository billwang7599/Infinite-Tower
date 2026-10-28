/** What the bag screen tells you about a stack: the lines of its tooltip. */
import { footprint, isWeapon, itemDef, type BagItem, type ItemId } from "@infinite-tower/shared";

const WIELDED = "In a hand: swing, stab and block.";
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

/** One decimal place at most: "12", "12.5". */
export const formatWeight = (weight: number): string => String(Math.round(weight * 10) / 10);

export function itemInfo(stack: BagItem): ItemInfo {
  const def = itemDef(stack.item);
  const { cols, rows } = footprint(stack.item, stack.turned);
  const each = formatWeight(def.weight);
  const many = stack.count > 1;
  return {
    name: many ? `${def.name} ×${stack.count}` : def.name,
    size: `${cols} × ${rows}`,
    weight: many ? `${each} each, ${formatWeight(def.weight * stack.count)} in all` : each,
    effect: def.healHp ? `Heals ${def.healHp} HP. Not mid-fight.`
      : isWeapon(stack.item) ? WIELDED : HELD[stack.item] ?? null,
  };
}
