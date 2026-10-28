/**
 * Who you play as, chosen once and kept for good. The server checks a character against these lists; the client's
 * drawings (client/src/gfx/look/) are keyed by them, so an option without art doesn't compile.
 */
import type { TextRules } from "../net/text-rules.js";

export const CHARACTER_NAME_RULES = {
  min: 2, max: 16, pattern: "^[A-Za-z0-9' \\-]+$", allowed: "letters, digits, spaces, ' or -",
} as const satisfies TextRules;

/** Only how the game refers to you. Every look option is open to either. */
export const GENDERS = ["boy", "girl"] as const;
export type Gender = (typeof GENDERS)[number];

/** In the order the creation screen lists them. */
export const LOOK_OPTIONS = {
  body: ["skinny", "medium", "wide"],
  face: ["soft", "sharp", "square"],
  skin: ["porcelain", "light", "tan", "brown", "dark"],
  hair: ["short", "bob", "long", "ponytail"],
  hairColor: ["black", "brown", "blonde", "red", "pink", "silver", "blue", "green"],
  eyes: ["round", "sharp", "sleepy", "cat"],
  eyeColor: ["amber", "blue", "teal", "red", "gold", "violet"],
  mouth: ["smile", "flat", "grin", "cat", "pout"],
  outfit: ["soot", "ash", "chalk", "slate", "oxblood", "moss"],
  accent: ["orange", "cyan", "crimson", "gold", "violet", "white"],
} as const;

export type LookPart = keyof typeof LOOK_OPTIONS;
export type Look = { [P in LookPart]: (typeof LOOK_OPTIONS)[P][number] };
export const LOOK_PARTS = Object.keys(LOOK_OPTIONS) as LookPart[];

export interface Character {
  name: string;
  gender: Gender;
  look: Look;
}

/** The look the creation screen starts from. */
export const DEFAULT_LOOK: Look = {
  body: "medium", face: "soft", skin: "light", hair: "short", hairColor: "black", eyes: "round", eyeColor: "blue",
  mouth: "smile", outfit: "slate", accent: "crimson",
};
