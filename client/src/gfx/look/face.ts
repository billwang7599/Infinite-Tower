/**
 * Eye types and mouth types. The portrait's are traced from Stable Diffusion pictures (base.ts), each eye type with
 * its brows. Chibi eyes are one grid, the left eye; the right is its mirror image. Facing side (to the left) only
 * the near eye shows, its front two columns; facing back, no face at all. The battle sprite's front has the chibi's
 * eyes and mouth where its scaled-up head (frontHead, battle.ts) puts them.
 * Letters: K/k lash and lower lash, H highlight, p pupil, D/I/L iris dark to light, n skin line, M/q mouth.
 */
import { ink, type Art } from "./art.js";
import { TRACED } from "./base.js";
import { onFrontHead } from "./battle.js";
import { BASE, DEEP, LIGHT, OUTLINE, SHADOW, type Ink } from "./pixels.js";

const LEGEND: Record<string, Ink> = {
  K: ink("line", OUTLINE), k: ink("line", SHADOW), H: ink("white", LIGHT),
  p: ink("iris", OUTLINE), D: ink("iris", DEEP), I: ink("iris", BASE), L: ink("iris", LIGHT),
  n: ink("skin", SHADOW), q: ink("mouth", DEEP), M: ink("mouth", BASE),
};

const CHIBI_EYE = { x: 11, y: 12, width: 3 };
const CHIBI_MOUTH_Y = 16;
/** Facing side: the eye, and the lips at the front of the face. */
const SIDE_EYE = { x: 10, y: 12 }, SIDE_LIPS = { x: 9, y: 16 };
/** The first `n` columns of a grid. */
const front = (grid: readonly string[], n: number) => grid.map((row) => row.slice(0, n));

function eyes(type: keyof typeof TRACED.eyes, chibi: readonly string[]): Art {
  return {
    portrait: { face: (pen) => pen.traced(TRACED.eyes[type]) },
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
  round: eyes("round", ["KKK", "HDp", "ILI"]),
  /** Narrower, the lid lower over the iris, the outer corner up: cool. */
  sharp: eyes("sharp", ["KKK", "HDp", ".kk"]),
  /** Half-lidded and soft. */
  sleepy: eyes("sleepy", ["...", "KKK", "HDp"]),
  /** Big iris, slit pupil, the outer corner swept up into a wing. */
  cat: eyes("cat", ["K..", "KKK", "HpI"]),
} as const satisfies Record<string, Art>;

function mouth(type: keyof typeof TRACED.mouth, chibi: readonly string[]): Art {
  return {
    portrait: { face: (pen) => pen.traced(TRACED.mouth[type]) },
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
  smile: mouth("smile", ["qq"]),
  flat: mouth("flat", ["nn"]),
  grin: mouth("grin", ["MM"]),
  cat: mouth("cat", ["q..q", ".qq."]),
  pout: mouth("pout", ["q"]),
} as const satisfies Record<string, Art>;
