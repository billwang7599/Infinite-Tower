import type { ArenaDef } from "@infinite-tower/shared";

export const GRASS_FIELD_ARENA: ArenaDef = { id: "grass-field", radius: 16, look: "forest-clearing" };
export const KOBOLD_RUINS_ARENA: ArenaDef = { ...GRASS_FIELD_ARENA, id: "kobold-ruins", look: "stone-ruins" };
export const WARLOCK_MIRE_ARENA: ArenaDef = { ...GRASS_FIELD_ARENA, id: "warlock-mire", look: "mire" };
