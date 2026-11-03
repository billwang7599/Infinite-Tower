/** What the bag screen tells you about a stack: the lines of its tooltip. */
import {
  footprint, isWeapon, itemDef, WEAPONS, type BagItem, type ItemEffect, type ItemId, type Rarity, type WeaponId,
} from "@infinite-tower/shared";

const WIELDED = "In a hand: light and heavy attacks, and a guard.";
const HELD: Partial<Record<ItemId, string>> = { skillbook: "In a hand: quick-cast skills." };

export const RARITY_NAME: Record<Rarity, string> = {
  common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary", unique: "Unique",
};
export const RARITY_TEXT: Record<Rarity, string> = {
  common: "text-rarity-common", uncommon: "text-rarity-uncommon", rare: "text-rarity-rare", epic: "text-rarity-epic",
  legendary: "text-rarity-legendary", unique: "text-rarity-unique",
};
export const RARITY_EDGE: Record<Rarity, string> = {
  common: "border-white/10", uncommon: "border-rarity-uncommon/60", rare: "border-rarity-rare/70",
  epic: "border-rarity-epic/70", legendary: "border-rarity-legendary/80", unique: "border-rarity-unique/80",
};

const SIGIL = "A sigil: Ysolde Thatcher of the Collegium, in the Market Ward, can carve it into your core.";

interface ItemInfo {
  /** With the count, for a stack of more than one. */
  name: string;
  rarity: Rarity;
  /** Cells across × down, as it lies. */
  size: string;
  weight: string;
  /** What using it does; null for things that can't be used. */
  effect: string | null;
}

export const effectsText = (effects: readonly ItemEffect[]): string => effects
  .map((effect) => ("healShare" in effect ? `Heals ${Math.round(effect.healShare * 100)}% of your HP.`
    : "staminaShare" in effect ? `Refills ${Math.round(effect.staminaShare * 100)}% of your stamina.`
    : "Absorbed into your core."))
  .join(" ");

/** One decimal place at most: "12", "12.5". */
export const formatWeight = (weight: number): string => String(Math.round(weight * 10) / 10);

function wieldedText(item: WeaponId): string {
  const need = WEAPONS[item].minStrength;
  return need > 0 ? `${WIELDED} Needs ${need} strength.` : WIELDED;
}

export function itemInfo(stack: BagItem): ItemInfo {
  const def = itemDef(stack.item), use = def.consumable;
  const { cols, rows } = footprint(stack.item, stack.turned);
  const each = formatWeight(def.weight);
  const many = stack.count > 1;
  return {
    name: many ? `${def.name} ×${stack.count}` : def.name,
    rarity: def.rarity,
    size: `${cols} × ${rows}`,
    weight: many ? `${each} each, ${formatWeight(def.weight * stack.count)} in all` : each,
    effect: use ? `${effectsText(use.effects)} Takes ${use.useTime} s; a hit stops it.`
      : isWeapon(stack.item) ? wieldedText(stack.item) : def.inscription ? SIGIL : HELD[stack.item] ?? null,
  };
}
