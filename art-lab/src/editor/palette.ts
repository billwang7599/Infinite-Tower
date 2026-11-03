import { ACCENTS, DYES, EYES, FIXED, HAIR, SKIN, type Ramp } from "@infinite-tower/client/src/gfx/look/palette.js";
import { hexToRgba, type Rgba } from "./bitmap.js";

export const PALETTE_GROUPS: readonly (readonly [string, Record<string, Ramp>])[] = [
  ["Skin", SKIN], ["Hair", HAIR], ["Eyes", EYES], ["Outfit", DYES], ["Accent", ACCENTS], ["Shared", FIXED],
];

export const GAME_COLORS: readonly Rgba[] = [
  ...new Set(PALETTE_GROUPS.flatMap(([, ramps]) => Object.values(ramps).flat())),
].map(hexToRgba);
