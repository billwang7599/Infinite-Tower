/**
 * Eye types and mouth types, as hand-drawn grids. The portrait's head is turned three-quarters to our left
 * (head.ts), so each eye type is two grids: the near eye (on the right, the full width) and the far eye
 * (narrower, its outer corner on the face's left edge). Both look at us, so the irises sit toward the right.
 * Chibi eyes are one grid, the left eye; the right is its mirror image.
 * Letters: K/k lash and lower lash, w/v eye white, H highlight, p pupil, D/d/I/L/S iris dark to light,
 * o/N/n skin lines, M/q inside the mouth, T teeth, m/b chibi mouth and brow.
 */
import { ink, type Art } from "./art.js";
import { BASE, DEEP, LIGHT, OUTLINE, SHADOW, SHINE, type Ink } from "./pixels.js";

const LEGEND: Record<string, Ink> = {
  K: ink("line", OUTLINE), k: ink("line", SHADOW),
  w: ink("white", BASE), v: ink("white", SHADOW), H: ink("white", LIGHT),
  p: ink("iris", OUTLINE), D: ink("iris", DEEP), d: ink("iris", SHADOW), I: ink("iris", BASE),
  L: ink("iris", LIGHT), S: ink("iris", SHINE),
  b: ink("hair", DEEP),
  o: ink("skin", OUTLINE), N: ink("skin", DEEP), n: ink("skin", SHADOW),
  m: ink("line", SHADOW), q: ink("mouth", DEEP), M: ink("mouth", BASE), t: ink("mouth", LIGHT), T: ink("white", LIGHT),
};

/** Where the eyes' grids go: both are 8 rows from row 20, the lashes on row 21, the lower lid's shadow on row 27. */
const NEAR_EYE = { x: 29, y: 20 }, FAR_EYE = { x: 18, y: 20 };
/** The mouth is centred here, a little left of the face's middle line, as the head is turned. */
const MOUTH = { x: 27, y: 33 };
const CHIBI_EYE = { x: 11, y: 12, width: 3 };
const CHIBI_MOUTH_Y = 16;

interface EyeType {
  near: readonly string[];
  far: readonly string[];
  chibi: readonly string[];
}

function eyes({ near, far, chibi }: EyeType): Art {
  return {
    portrait: {
      face: (pen) => {
        pen.grid(NEAR_EYE.x, NEAR_EYE.y, near, LEGEND);
        pen.grid(FAR_EYE.x, FAR_EYE.y, far, LEGEND);
      },
    },
    chibi: {
      face: (pen) => {
        const { x, y, width } = CHIBI_EYE;
        pen.grid(x, y, chibi, LEGEND);
        pen.grid(32 - x - width, y, chibi, LEGEND, true);
      },
    },
  };
}

export const EYE_TYPES = {
  /** Big, open and gentle. */
  round: eyes({
    near: ["..KKKK..", ".KKKKKKK", "KwDDDDKK", ".wHdpdK.", ".wdppIK.", ".vIIILk.", "..LSSL..", "...nn..."],
    far: ["..KKK.", "KKKKKK", "KKDDDK", ".wHpdw", ".wdpIw", ".vILLv", "..SL..", "..nn.."],
    chibi: ["KKK", "HDp", "ILI"],
  }),
  /** Narrower, the lid lower over the iris, the outer corner up: cool. */
  sharp: eyes({
    near: ["........", "......KK", "..KKKKKK", "KKKDDDK.", ".wHdpdK.", ".vdppIk.", "..ILLn..", "...nn..."],
    far: ["......", "K.....", "KKKKK.", "KKDDDK", ".wHpdw", ".vdpIv", "..LLn.", "..nn.."],
    chibi: ["KKK", "HDp", ".kk"],
  }),
  /** Half-lidded and soft. */
  sleepy: eyes({
    near: ["........", "........", ".nnnnnn.", "KKKKKKKK", ".wDDpDK.", ".vIppIk.", "..LSSL..", "...nn..."],
    far: ["......", "......", ".nnnn.", "KKKKKK", ".wDpDK", ".vIpIv", "..SL..", "..nn.."],
    chibi: ["...", "KKK", "HDp"],
  }),
  /** Big iris, slit pupil, the outer corner swept up into a wing. */
  cat: eyes({
    near: [".......K", "..KKKKKK", ".KKDDDKK", "KwHDpDK.", ".wdDpIK.", ".vIIpLk.", "..LSSL..", "...nn..."],
    far: ["K.....", "KKKKK.", "KKDDDK", ".wHpDw", ".wdpIw", ".vIpLv", "..SL..", "..nn.."],
    chibi: ["K..", "KKK", "HpI"],
  }),
} as const satisfies Record<string, Art>;

function mouth(portrait: readonly string[], chibi: readonly string[]): Art {
  return {
    portrait: { face: (pen) => pen.grid(MOUTH.x - Math.floor(portrait[0]!.length / 2), MOUTH.y, portrait, LEGEND) },
    chibi: { face: (pen) => pen.grid(16 - Math.floor(chibi[0]!.length / 2), CHIBI_MOUTH_Y, chibi, LEGEND) },
  };
}

export const MOUTH_TYPES = {
  smile: mouth(["o..o", ".oo."], ["qq"]),
  flat: mouth([".oo.", "..n."], ["nn"]),
  grin: mouth(["oooo", "oTTo", ".MM."], ["MM"]),
  cat: mouth(["o.o.o", ".o.o."], ["q..q", ".qq."]),
  pout: mouth([".o.", "oMo", ".n."], ["q"]),
} as const satisfies Record<string, Art>;
