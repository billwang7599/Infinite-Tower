/**
 * Hair styles. Portrait hair is traced from Stable Diffusion pictures (base.ts): the front over the head, the back
 * (what lies outside the base's outline) behind the body, and the shadow it casts on the forehead. Chibi hair
 * (facing front, back and side), and the battle sprite's from behind, are drawn from shapes (chibi.ts,
 * chibi-back.ts, chibi-side.ts, back.ts); from the front the battle sprite has the chibi's front hair, scaled up.
 */
import type { Art } from "../art.js";
import { TRACED } from "../base.js";
import { gridMask } from "../pixels.js";
import { BACK_HAIR, drawHairFromBehind } from "./back.js";
import { battleFront, CHIBI_HAIR, drawBattleFront, drawBehindHead, drawChibiFront, drawChibiHair } from "./chibi.js";
import { CHIBI_HAIR_BEHIND, drawChibiFromBehind } from "./chibi-back.js";
import { CHIBI_HAIR_SIDEWAYS, SIDEWAYS } from "./chibi-side.js";

type Style = keyof typeof CHIBI_HAIR & keyof typeof BACK_HAIR & keyof typeof CHIBI_HAIR_BEHIND &
  keyof typeof CHIBI_HAIR_SIDEWAYS;

function hair(style: Style & keyof typeof TRACED.hair): Art {
  const { front, back, shade } = TRACED.hair[style];
  const chibi = CHIBI_HAIR[style], fromBehind = BACK_HAIR[style];
  return {
    portrait: {
      hairBack: (pen) => pen.traced(back),
      hair: (pen) => {
        pen.castShadow(gridMask(shade.x, shade.y, shade.rows), "skin");
        pen.traced(front);
      },
    },
    chibi: {
      front: { hairBack: (pen) => drawBehindHead(pen, chibi), hair: (pen) => drawChibiFront(pen, chibi) },
      back: { hair: (pen) => drawChibiFromBehind(pen, CHIBI_HAIR_BEHIND[style]) },
      side: { hair: (pen) => drawChibiHair(pen, CHIBI_HAIR_SIDEWAYS[style], SIDEWAYS) },
    },
    battle: {
      back: { hair: (pen, { head }) => drawHairFromBehind(pen, fromBehind, head) },
      front: {
        hairBack: (pen, { head }) => drawBehindHead(pen, battleFront(chibi, head)),
        hair: (pen, { head }) => drawBattleFront(pen, chibi, head),
      },
    },
  };
}

// Where a style sits inside the bald head, its picture shows background. The cut is the base's (drawn on its head
// layer), since a part stacked over another can't make it see-through again.
const crownCut = (style: keyof typeof TRACED.hair): Art => {
  const { cut } = TRACED.hair[style];
  return { portrait: { head: (pen) => pen.erase(gridMask(cut.x, cut.y, cut.rows)) } };
};

export const CROWN_CUTS = {
  short: crownCut("short"), bob: crownCut("bob"), long: crownCut("long"), ponytail: crownCut("ponytail"),
} as const satisfies Record<Style, Art>;

export const HAIR_STYLES = {
  short: hair("short"),
  bob: hair("bob"),
  long: hair("long"),
  ponytail: hair("ponytail"),
} as const satisfies Record<string, Art>;
