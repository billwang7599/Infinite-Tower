/**
 * The head, and its face shapes. Anime proportions: a big cranium, big eyes a little below the middle of the
 * head, a short lower face narrowing quickly to a small chin. Every shape shares the cranium, the ear and the
 * rows the eyes, nose and mouth sit on (face.ts), so hair and faces fit every shape; only the jaw changes.
 * Portrait: traced from Stable Diffusion pictures (base.ts), turned three-quarters to our left; the face shapes are
 * the same head repainted below the eyes.
 * Chibi: facing front, symmetric around x = 16, chin at row 19. Facing back it's the back of the head
 * and the ears; facing side (to the left), one profile for every face shape, small enough that the jaw doesn't show.
 * Battle: from behind, the head is all hair (hair/back.ts), so face shapes draw nothing there; from the front it's
 * the chibi's front head, scaled up (frontHead, battle.ts).
 */
import { ink, type Art, type Piece } from "./art.js";
import { TRACED } from "./base.js";
import { frontHead } from "./battle.js";
import {
  BASE, DEEP, SHADOW, ellipse, farSide, gridMask, mirror, polygon, rect, shift, symmetric, union, type Ink, type Mask,
  type Point,
} from "./pixels.js";

const C = 32;
const skin = ink("skin", BASE);

const CHIBI_CRANIUM = ellipse(16, 11, 8.2, 7.6);
const CHIBI_EARS = mirror(rect(7, 12, 7, 13), C);
const ROUND_EARS = mirror(ellipse(7.4, 13, 1.1, 1.3), C);
/** The chibi's head facing side (left): brow, nose, lips and chin. */
const CHIBI_PROFILE = union(ellipse(17, 11, 8.2, 7.6), polygon([
  [9.2, 8], [8.4, 12.6], [7.6, 14], [8.4, 15], [8.5, 16.4], [9.8, 18.3], [12.4, 19.3], [15.8, 19.2], [18.4, 17.4],
  [19, 13], [16, 9],
]));
const CHIBI_SIDE_EAR_GRID = ["NB", "Nn", ".N"];
/** The ear, facing side: short hair leaves it bare (hair/chibi-side.ts). */
export const CHIBI_SIDE_EAR = gridMask(18, 12, CHIBI_SIDE_EAR_GRID);
const EAR_LEGEND: Record<string, Ink> = { N: ink("skin", DEEP), B: skin, n: ink("skin", SHADOW) };

function faceShape(shape: keyof typeof TRACED.head, chibiJaw: readonly Point[]): Art {
  const chibi: Mask = union(CHIBI_CRANIUM, symmetric([[16, 14], [8.2, 12.5], ...chibiJaw], C));
  return {
    portrait: { head: (pen) => pen.traced(TRACED.head[shape]) },
    chibi: {
      front: {
        body: (pen) => pen.fill(CHIBI_EARS, skin),
        head: (pen) => {
          pen.castShadow(shift(chibi, 0, 1), "skin", SHADOW);
          pen.fill(chibi, skin);
        },
      },
      back: CHIBI_BACK_OF_HEAD,
      side: CHIBI_SIDE_HEAD,
    },
    battle: {
      front: {
        body: (pen, { head }) => pen.fill(frontHead(ROUND_EARS, head), skin),
        head: (pen, { head }) => {
          const face = frontHead(chibi, head);
          pen.castShadow(shift(face, 0, 1), "skin", SHADOW);
          pen.fill(face, skin);
        },
      },
    },
  };
}

const CHIBI_BACK_OF_HEAD: Piece = {
  body: (pen) => pen.fill(CHIBI_EARS, skin),
  head: (pen) => pen.fill(CHIBI_CRANIUM, skin),
};

const CHIBI_SIDE_HEAD: Piece = {
  head: (pen) => {
    pen.castShadow(shift(CHIBI_PROFILE, 0, 1), "skin", SHADOW);
    pen.fill(CHIBI_PROFILE, skin);
    pen.shade(farSide(CHIBI_PROFILE, 1), SHADOW);
    pen.grid(18, 12, CHIBI_SIDE_EAR_GRID, EAR_LEGEND);
  },
  face: (pen) => pen.dot(11, 15, ink("blush", SHADOW)),
};

export const FACE_SHAPES = {
  soft: faceShape("soft", [[9.5, 16.5], [12, 18.6], [16, 19.4]]),
  sharp: faceShape("sharp", [[9.4, 16], [12.6, 18.6], [15, 19.4], [16, 19.6]]),
  /** Cheeks straight down to a low jaw corner, a wide flat chin. */
  square: faceShape("square", [[8.8, 16.8], [10.8, 18.8], [16, 19.4]]),
} as const satisfies Record<string, Art>;
