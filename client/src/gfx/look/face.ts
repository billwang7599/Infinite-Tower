/**
 * Eye types and mouth types, as hand-drawn grids. The portrait's head is turned three-quarters to our left
 * (head.ts), so each eye type is two grids: the near eye (on the right, the full width) and the far eye
 * (narrower, its outer corner on the face's left edge). Both look at us, so the irises sit toward the right.
 * Chibi eyes are one grid, the left eye; the right is its mirror image. Facing side (to the left) only the near
 * eye shows, its front two columns; facing back, no face at all. The battle sprite's front has the chibi's eyes
 * and mouth where its scaled-up head (frontHead, battle.ts) puts them.
 * Letters: K/k lash and lower lash, w/v eye white, H highlight, p pupil, D/d/I/L/S iris dark to light,
 * o/N/n skin lines, M/q inside the mouth, T teeth, m/b chibi mouth and brow.
 */
import { ink, type Art } from "./art.js";
import { onFrontHead } from "./battle.js";
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
/** Facing side: the eye, and the lips at the front of the face. */
const SIDE_EYE = { x: 10, y: 12 }, SIDE_LIPS = { x: 9, y: 16 };
/** The first `n` columns of a grid. */
const front = (grid: readonly string[], n: number) => grid.map((row) => row.slice(0, n));

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
      front: {
        face: (pen) => {
          const { x, y, width } = CHIBI_EYE;
          pen.grid(x, y, chibi, LEGEND);
          pen.grid(32 - x - width, y, chibi, LEGEND, true);
        },
      },
      side: { face: (pen) => pen.grid(SIDE_EYE.x, SIDE_EYE.y, front(chibi, 2), LEGEND) },
    },
    battle: {
      front: {
        face: (pen, { head: [dx, dy] }) => {
          const { x, y, width } = CHIBI_EYE, size = chibi.length;
          const [cx, cy] = onFrontHead([x + width / 2, y + size / 2], [0, dy]);
          const left = Math.round(cx - width / 2), top = Math.round(cy - size / 2);
          pen.grid(left + dx, top, chibi, LEGEND);
          pen.grid(64 - left - width + dx, top, chibi, LEGEND, true);
        },
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
    chibi: {
      front: { face: (pen) => pen.grid(16 - Math.floor(chibi[0]!.length / 2), CHIBI_MOUTH_Y, chibi, LEGEND) },
      side: { face: (pen) => pen.grid(SIDE_LIPS.x, SIDE_LIPS.y, front(chibi, 1), LEGEND) },
    },
    battle: {
      front: {
        face: (pen, { head }) => {
          const [, y] = onFrontHead([16, CHIBI_MOUTH_Y + 0.5], head);
          pen.grid(32 + head[0] - Math.floor(chibi[0]!.length / 2), Math.floor(y), chibi, LEGEND);
        },
      },
    },
  };
}

export const MOUTH_TYPES = {
  smile: mouth(["o..o", ".oo."], ["qq"]),
  flat: mouth([".oo.", "..n."], ["nn"]),
  grin: mouth(["oooo", "oTTo", ".MM."], ["MM"]),
  cat: mouth(["o.o.o", ".o.o."], ["q..q", ".qq."]),
  pout: mouth([".o.", "oMo", ".n."], ["q"]),
} as const satisfies Record<string, Art>;
