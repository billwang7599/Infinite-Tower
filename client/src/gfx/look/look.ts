/**
 * A look (shared/src/character/character.ts: the choices made at character creation) turned into pictures, one
 * per view. Each option id indexes its art or colors here, so an option shared/ lists without art doesn't compile.
 */
import type { Look } from "@infinite-tower/shared";
import { render, type Art, type Colors, type Picture } from "./art.js";
import type { Pose } from "./battle.js";
import { BODY, BODY_TYPES } from "./body.js";
import { EYE_TYPES, MOUTH_TYPES } from "./face.js";
import { FACE_SHAPES } from "./head.js";
import { HAIR_STYLES } from "./hair/index.js";
import { STARTER_CLOTHES } from "./outfit.js";
import { ACCENTS, DYES, EYES, FIXED, HAIR, SKIN } from "./palette.js";
import { SWORD } from "./sword.js";

export type { Look };

/** Everything drawn for a look: the body and head, its features, then what it wears. */
export function lookArts(look: Look, wear: readonly Art[] = STARTER_CLOTHES): Art[] {
  return [BODY, FACE_SHAPES[look.face], HAIR_STYLES[look.hair], EYE_TYPES[look.eyes], MOUTH_TYPES[look.mouth], ...wear];
}

/** The views with one picture each: the battle sprite has a picture per pose (drawBattle). */
export type StillView = "portrait" | "chibi";

export function drawLook(look: Look, view: StillView, wear?: readonly Art[]): Picture {
  return render(view, BODY_TYPES[look.body][view], lookArts(look, wear), colorsOf(look), FIXED);
}

/** The battle sprite in `pose`, sword in hand. */
export function drawBattle(look: Look, pose: Pose, wear: readonly Art[] = STARTER_CLOTHES): Picture {
  return render("battle", BODY_TYPES[look.body].battle[pose], lookArts(look, [...wear, SWORD]), colorsOf(look), FIXED);
}

const colorsOf = (look: Look): Colors => ({
  skin: SKIN[look.skin], hair: HAIR[look.hairColor], iris: EYES[look.eyeColor], cloth: DYES[look.outfit],
  accent: ACCENTS[look.accent],
});
