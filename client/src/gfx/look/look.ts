/**
 * A look (shared/src/character/character.ts: the choices made at character creation) drawn as pictures: the
 * portrait, the chibi facing each way, and the battle sprite in each pose. Each option id indexes its art or
 * colors here, so an option shared/ lists without art doesn't compile.
 */
import type { Hand, Look } from "@infinite-tower/shared";
import { render, type Art, type ChibiFacing, type Colors, type Picture } from "./art.js";
import { leftHanded, type Pose, type SwordPose } from "./battle.js";
import { BODY, BODY_TYPES } from "./body.js";
import { EYE_TYPES, MOUTH_TYPES } from "./face.js";
import { FACE_SHAPES } from "./head.js";
import { HAIR_STYLES } from "./hair/index.js";
import { STARTER_CLOTHES } from "./outfit.js";
import { ACCENTS, DYES, EYES, FIXED, HAIR, SKIN } from "./palette.js";
import { SWORD } from "./sword.js";

export type { Look };
export { CHIBI_FACINGS, type ChibiFacing } from "./art.js";

/** Everything drawn for a look: the body and head, its features, then what it wears. */
function lookArts(look: Look, wear: readonly Art[] = STARTER_CLOTHES): Art[] {
  return [BODY, FACE_SHAPES[look.face], HAIR_STYLES[look.hair], EYE_TYPES[look.eyes], MOUTH_TYPES[look.mouth], ...wear];
}

export function drawPortrait(look: Look, wear?: readonly Art[]): Picture {
  const pieces = lookArts(look, wear).map((art) => art.portrait);
  return render("portrait", BODY_TYPES[look.body].portrait, pieces, colorsOf(look), FIXED);
}

/** The chibi facing `facing`; the overworld picks one by where the player last walked. */
export function drawChibi(look: Look, facing: ChibiFacing, wear?: readonly Art[]): Picture {
  const pieces = lookArts(look, wear).map((art) => art.chibi?.[facing]);
  return render("chibi", BODY_TYPES[look.body].chibi[facing], pieces, colorsOf(look), FIXED);
}

/** The battle sprite in `pose` (its `frame`th frame), `weapon` in `swordHand` (null: none). */
export function drawBattle(
  look: Look, pose: Pose | SwordPose, frame = 0, wear: readonly Art[] = STARTER_CLOTHES,
  swordHand: Hand | null = "rightHand", weapon: Art = SWORD,
): Picture {
  const frames = BODY_TYPES[look.body].battle;
  const body = swordHand === "leftHand" ? leftHanded(frames, pose, frame) : frames[pose][frame];
  if (!body) throw new RangeError(`${pose} has no frame ${frame}`);
  const pieces = lookArts(look, swordHand ? [...wear, weapon] : wear).map((art) => art.battle);
  return render("battle", body, pieces, colorsOf(look), FIXED);
}

const colorsOf = (look: Look): Colors => ({
  skin: SKIN[look.skin], hair: HAIR[look.hairColor], iris: EYES[look.eyeColor], cloth: DYES[look.outfit],
  accent: ACCENTS[look.accent],
});
