import type { Stats } from "@infinite-tower/shared";

/** What the character panel says about each stat, in the order it lists them (rules: shared/src/battle/stats.ts). */
export const STAT_TEXT: Record<keyof Stats, { name: string; effect: (value: number) => string }> = {
  strength: { name: "Strength", effect: (v) => `Physical damage ×${(v / 10).toFixed(1)}` },
  agility: { name: "Agility", effect: (v) => `Movement in fights ×${(v / 10).toFixed(1)}` },
  stamina: { name: "Stamina", effect: (v) => `Stamina bar: ${v}` },
  mana: { name: "Mana", effect: (v) => `Mana pool: ${v} (no spells yet)` },
  spellpower: { name: "Spellpower", effect: (v) => `Spell damage ×${(v / 10).toFixed(1)} (no spells yet)` },
};

export const STAT_KEYS = Object.keys(STAT_TEXT) as (keyof Stats)[];
