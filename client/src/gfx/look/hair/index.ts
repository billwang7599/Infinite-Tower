/**
 * Hair styles. Portrait hair is hand-drawn, one file per style: a front grid over the head and, for hair that
 * falls behind the head and shoulders, a back grid. Both are full-width rows from the picture's top. Letters
 * are tones of the hair color (d deep, s shadow, b base, l light, w shine), and a/A a tie in the accent color.
 * Outlines are added when the picture is put together (art.ts): dark where hair meets skin or the background,
 * deep where the front lies over the back. Chibi hair is drawn from shapes (chibi.ts).
 */
import { ink, type Art } from "../art.js";
import { BASE, DEEP, LIGHT, SHADOW, SHINE, gridMask, shift, type Ink } from "../pixels.js";
import { CHIBI_HAIR, drawChibiBack, drawChibiFront } from "./chibi.js";
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

function hair(portrait: PortraitHair, chibi: (typeof CHIBI_HAIR)[keyof typeof CHIBI_HAIR]): Art {
  const { front, back } = portrait;
  return {
    portrait: {
      hairBack: (pen) => { if (back) pen.grid(0, 0, back, TONES); },
      hair: (pen) => {
        pen.castShadow(shift(gridMask(0, 0, front), 0, 2), "skin"); // the bangs' shadow on the forehead
        pen.grid(0, 0, front, TONES);
      },
    },
    chibi: { hairBack: (pen) => drawChibiBack(pen, chibi), hair: (pen) => drawChibiFront(pen, chibi) },
  };
}

export const HAIR_STYLES = {
  short: hair(SHORT, CHIBI_HAIR.short),
  bob: hair(BOB, CHIBI_HAIR.bob),
  long: hair(LONG, CHIBI_HAIR.long),
  ponytail: hair(PONYTAIL, CHIBI_HAIR.ponytail),
} as const satisfies Record<string, Art>;
