/** The creation panel's rows, one per choice (the name has its own), and stepping through their options. */
import { GENDERS, LOOK_OPTIONS, type Gender, type Look, type LookPart } from "@infinite-tower/shared";
import { ACCENTS, DYES, EYES, HAIR, SKIN, type Ramp } from "../../../gfx/look/palette.js";

/** Everything the panel picks but the name. */
export interface Choices {
  gender: Gender;
  look: Look;
}
export type ChoiceKey = "gender" | LookPart;

export interface Row {
  key: ChoiceKey;
  label: string;
  options: readonly string[];
  /** Color rows show a swatch per option (the ramp's base tone); the rest show the option's name. */
  swatch?: (id: string) => string;
}

const baseTone = (ramps: Readonly<Record<string, Ramp>>) => (id: string) => ramps[id]![3];

export const ROWS: readonly Row[] = [
  { key: "gender", label: "Boy or girl", options: GENDERS },
  { key: "body", label: "Build", options: LOOK_OPTIONS.body },
  { key: "face", label: "Face", options: LOOK_OPTIONS.face },
  { key: "skin", label: "Skin", options: LOOK_OPTIONS.skin, swatch: baseTone(SKIN) },
  { key: "hair", label: "Hair", options: LOOK_OPTIONS.hair },
  { key: "hairColor", label: "Hair color", options: LOOK_OPTIONS.hairColor, swatch: baseTone(HAIR) },
  { key: "eyes", label: "Eyes", options: LOOK_OPTIONS.eyes },
  { key: "eyeColor", label: "Eye color", options: LOOK_OPTIONS.eyeColor, swatch: baseTone(EYES) },
  { key: "mouth", label: "Mouth", options: LOOK_OPTIONS.mouth },
  { key: "outfit", label: "Clothes", options: LOOK_OPTIONS.outfit, swatch: baseTone(DYES) },
  { key: "accent", label: "Trim", options: LOOK_OPTIONS.accent, swatch: baseTone(ACCENTS) },
];

/** "hairColor" ids are plain words: "silver" shows as "Silver". */
export const optionName = (id: string): string => id.charAt(0).toUpperCase() + id.slice(1);

export const valueOf = (choices: Choices, key: ChoiceKey): string =>
  key === "gender" ? choices.gender : choices.look[key];

export function withValue(choices: Choices, key: ChoiceKey, id: string): Choices {
  return key === "gender"
    ? { ...choices, gender: id as Gender }
    : { ...choices, look: { ...choices.look, [key]: id } };
}

/** The next (`by` 1) or previous (-1) option in `row`, wrapping around. */
export function stepped(choices: Choices, row: Row, by: 1 | -1): Choices {
  const at = row.options.indexOf(valueOf(choices, row.key));
  return withValue(choices, row.key, row.options[(at + by + row.options.length) % row.options.length]!);
}

/** A random look; the gender stays as picked. */
export function shuffled(choices: Choices, random: () => number = Math.random): Choices {
  return ROWS.filter((row) => row.key !== "gender").reduce(
    (c, row) => withValue(c, row.key, row.options[Math.floor(random() * row.options.length)]!), choices,
  );
}
