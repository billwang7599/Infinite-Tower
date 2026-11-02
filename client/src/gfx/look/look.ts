/**
 * A look (shared/src/character/character.ts: the choices made at character creation) drawn as pictures: the
 * portrait, the chibi facing each way, and the battle sprite in each pose from behind and the front. Each option id
 * indexes its art or colors here, so an option shared/ lists without art doesn't compile.
 */
import type { Hand, Look } from "@infinite-tower/shared";
import {
  render, type Art, type BattleFacing, type BattleFrame, type ChibiFacing, type Picture, type Sketch,
} from "./art.js";
import { leftHanded, type Pose, type SwordPose } from "./battle.js";
import { BODY, BODY_TYPES } from "./body.js";
import { EYE_TYPES, MOUTH_TYPES } from "./face.js";
import { FACE_SHAPES } from "./head.js";
import { HAIR_STYLES } from "./hair/index.js";
import { STARTER_CLOTHES, type Wear } from "./outfit.js";
import { ACCENTS, DYES, EYES, FIXED, HAIR, SKIN, type Ramp } from "./palette.js";
import { SWORD } from "./sword.js";

export type { Look };
export { BATTLE_FACINGS, CHIBI_FACINGS, type BattleFacing, type ChibiFacing } from "./art.js";

function lookArts(look: Look, wear: Wear): (readonly [string, Art])[] {
  return [
    ["base", BODY], ["base", FACE_SHAPES[look.face]], ["hair", HAIR_STYLES[look.hair]], ["eyes", EYE_TYPES[look.eyes]],
    ["mouth", MOUTH_TYPES[look.mouth]], ...Object.entries(wear),
  ];
}

export const portraitSketch = (look: Look, wear: Wear = STARTER_CLOTHES): Sketch => ({
  view: "portrait", frame: BODY_TYPES[look.body].portrait, colors: colorsOf(look),
  parts: lookArts(look, wear).map(([part, art]) => [part, art.portrait]),
});

export const chibiSketch = (look: Look, facing: ChibiFacing, wear: Wear = STARTER_CLOTHES): Sketch => ({
  view: "chibi", frame: BODY_TYPES[look.body].chibi[facing], colors: colorsOf(look),
  parts: lookArts(look, wear).map(([part, art]) => [part, art.chibi?.[facing]]),
});

export function battleSketch(
  look: Look, pose: Pose | SwordPose, frame = 0, facing: BattleFacing = "back", wear: Wear = STARTER_CLOTHES,
  swordHand: Hand | null = "rightHand", weapon: Art | null = SWORD,
): Sketch<BattleFrame> {
  const arts = lookArts(look, swordHand && weapon ? { ...wear, weapon } : wear);
  return {
    view: "battle", frame: battleBody(look, pose, frame, facing, swordHand), colors: colorsOf(look),
    parts: arts.map(([part, art]) => [part, art.battle?.[facing]]),
  };
}

export const drawPortrait = (look: Look, wear?: Wear): Picture => render(portraitSketch(look, wear));

/** The chibi facing `facing`; the overworld picks one by where the player last walked. */
export const drawChibi = (look: Look, facing: ChibiFacing, wear?: Wear): Picture =>
  render(chibiSketch(look, facing, wear));

export function battleBody(
  look: Look, pose: Pose | SwordPose, frame: number, facing: BattleFacing, swordHand: Hand | null,
): BattleFrame {
  const frames = BODY_TYPES[look.body].battle[facing];
  const body = swordHand === "leftHand" ? leftHanded(frames, pose, frame) : frames[pose][frame];
  if (!body) throw new RangeError(`${pose} has no frame ${frame}`);
  return body;
}

export const drawBattle = (...args: Parameters<typeof battleSketch>): Picture => render(battleSketch(...args));

const colorsOf = (look: Look): Readonly<Record<string, Ramp>> => ({
  ...FIXED, skin: SKIN[look.skin], hair: HAIR[look.hairColor], iris: EYES[look.eyeColor], cloth: DYES[look.outfit],
  accent: ACCENTS[look.accent],
});
