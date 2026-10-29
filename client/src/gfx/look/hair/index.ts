/**
 * Hair styles. Portrait hair is hand-drawn, one file per style: a front grid over the head and, for hair that
 * falls behind the head and shoulders, a back grid. Both are full-width rows from the picture's top. Letters
 * are tones of the hair color (d deep, s shadow, b base, l light, w shine), and a/A a tie in the accent color.
 * Outlines are added when the picture is put together (art.ts): dark where hair meets skin or the background,
 * deep where the front lies over the back. Chibi hair (facing front, back and side), and the battle sprite's from
 * behind, are drawn from shapes (chibi.ts, chibi-back.ts, chibi-side.ts, back.ts); from the front the battle sprite
 * has the chibi's front hair, scaled up.
 */
import { ink, type Art } from "../art.js";
import { BASE, DEEP, LIGHT, SHADOW, SHINE, gridMask, shift, type Ink } from "../pixels.js";
import { BACK_HAIR, drawHairFromBehind } from "./back.js";
import { battleFront, CHIBI_HAIR, drawBattleFront, drawBehindHead, drawChibiFront, drawChibiHair } from "./chibi.js";
import { CHIBI_HAIR_BEHIND, drawChibiFromBehind } from "./chibi-back.js";
import { CHIBI_HAIR_SIDEWAYS, SIDEWAYS } from "./chibi-side.js";
import { BOB } from "./bob.js";
import { LONG } from "./long.js";
import { PONYTAIL } from "./ponytail.js";
import { SHORT } from "./short.js";

interface PortraitHair {
  front: readonly string[];
  back?: readonly string[];
}

const TONES: Record<string, Ink> = {
  d: ink("hair", DEEP), s: ink("hair", SHADOW), b: ink("hair", BASE), l: ink("hair", LIGHT), w: ink("hair", SHINE),
  a: ink("accent", BASE), A: ink("accent", LIGHT),
};

type Style = keyof typeof CHIBI_HAIR & keyof typeof BACK_HAIR & keyof typeof CHIBI_HAIR_BEHIND &
  keyof typeof CHIBI_HAIR_SIDEWAYS;

function hair(portrait: PortraitHair, style: Style): Art {
  const { front, back } = portrait;
  const chibi = CHIBI_HAIR[style], fromBehind = BACK_HAIR[style];
  return {
    portrait: {
      hairBack: (pen) => { if (back) pen.grid(0, 0, back, TONES); },
      hair: (pen) => {
        pen.castShadow(shift(gridMask(0, 0, front), 0, 2), "skin"); // the bangs' shadow on the forehead
        pen.grid(0, 0, front, TONES);
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

export const HAIR_STYLES = {
  short: hair(SHORT, "short"),
  bob: hair(BOB, "bob"),
  long: hair(LONG, "long"),
  ponytail: hair(PONYTAIL, "ponytail"),
} as const satisfies Record<string, Art>;
