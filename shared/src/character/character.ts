/**
 * Who you play as: a name and a look, chosen on your first visit (and changeable from the character panel).
 * The server stores it and checks it against these lists (client-messages.ts); the client paints the player's
 * sprites from it (client/src/gfx/characters.ts). Adding an option is one entry here.
 */

import type { TextRules } from "../net/text-rules.js";

export const CHARACTER_NAME_RULES = {
  min: 2, max: 16, pattern: "^[A-Za-z0-9' \\-]+$", allowed: "letters, digits, spaces, ' or -",
} as const satisfies TextRules;

export const LOOKS = {
  /** Four shades each: base, hi (lit side), lo (shadow) and the hood tip, which sits between lo and base. */
  cloak: [
    { id: "red", label: "Red", colors: { base: "#c0453a", hi: "#d9584a", lo: "#8e2f27", tip: "#a8392f" } },
    { id: "blue", label: "Blue", colors: { base: "#3a62c0", hi: "#4d78d9", lo: "#283f8e", tip: "#3150a8" } },
    { id: "green", label: "Green", colors: { base: "#3f8a46", hi: "#52a35a", lo: "#2b6131", tip: "#357540" } },
    { id: "purple", label: "Purple", colors: { base: "#7a45b0", hi: "#9058c9", lo: "#57307f", tip: "#683b98" } },
    { id: "gold", label: "Gold", colors: { base: "#c79a2e", hi: "#ddb043", lo: "#946f1c", tip: "#ab8424" } },
    { id: "gray", label: "Gray", colors: { base: "#6b6f78", hi: "#82868f", lo: "#4b4e55", tip: "#5c6068" } },
  ],
  skin: [
    { id: "light", label: "Light", colors: "#f1c9a5" },
    { id: "tan", label: "Tan", colors: "#d9a37a" },
    { id: "brown", label: "Brown", colors: "#a8704a" },
    { id: "dark", label: "Dark", colors: "#6e4630" },
  ],
  legs: [
    { id: "navy", label: "Navy", colors: "#3b4a6b" },
    { id: "brown", label: "Brown", colors: "#5a4130" },
    { id: "black", label: "Black", colors: "#25252b" },
    { id: "olive", label: "Olive", colors: "#4e5a34" },
  ],
} as const;

export type LookPart = keyof typeof LOOKS;
export type Look = { [P in LookPart]: (typeof LOOKS)[P][number]["id"] };

export interface Character {
  name: string;
  look: Look;
}

/** The look a new character starts from (the original red-cloaked sprite). */
export const DEFAULT_LOOK: Look = { cloak: "red", skin: "light", legs: "navy" };

export const LOOK_PARTS = Object.keys(LOOKS) as LookPart[];

/** The colors for one part of a look. */
export function lookColors<P extends LookPart>(part: P, look: Look): (typeof LOOKS)[P][number]["colors"] {
  const options = LOOKS[part] as readonly { id: string; colors: (typeof LOOKS)[P][number]["colors"] }[];
  return (options.find((o) => o.id === look[part]) ?? options[0]!).colors;
}
