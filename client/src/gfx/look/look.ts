/**
 * A look: the choices made at character creation. Turns them into pictures, one per view.
 */
import { render, type Art, type Picture, type View } from "./art.js";
import { BODY, BODY_TYPES } from "./body.js";
import { EYE_TYPES, MOUTH_TYPES } from "./face.js";
import { FACE_SHAPES } from "./head.js";
import { HAIR_STYLES } from "./hair/index.js";
import { STARTER_CLOTHES } from "./outfit.js";
import { ACCENTS, DYES, EYES, FIXED, HAIR, SKIN } from "./palette.js";

export interface Look {
  body: keyof typeof BODY_TYPES;
  face: keyof typeof FACE_SHAPES;
  skin: keyof typeof SKIN;
  hair: keyof typeof HAIR_STYLES;
  hairColor: keyof typeof HAIR;
  eyes: keyof typeof EYE_TYPES;
  eyeColor: keyof typeof EYES;
  mouth: keyof typeof MOUTH_TYPES;
  outfit: keyof typeof DYES;
  accent: keyof typeof ACCENTS;
}

/** Everything drawn for a look: the body and head, its features, then what it wears. */
export function lookArts(look: Look, wear: readonly Art[] = STARTER_CLOTHES): Art[] {
  return [BODY, FACE_SHAPES[look.face], HAIR_STYLES[look.hair], EYE_TYPES[look.eyes], MOUTH_TYPES[look.mouth], ...wear];
}

export function drawLook(look: Look, view: View, wear?: readonly Art[]): Picture {
  const colors = {
    skin: SKIN[look.skin], hair: HAIR[look.hairColor], iris: EYES[look.eyeColor], cloth: DYES[look.outfit],
    accent: ACCENTS[look.accent],
  };
  return render(view, BODY_TYPES[look.body][view], lookArts(look, wear), colors, FIXED);
}
