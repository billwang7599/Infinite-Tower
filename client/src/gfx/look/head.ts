/**
 * The head, and its face shapes. Anime proportions: a big cranium, big eyes a little below the middle of the
 * head, a short lower face narrowing quickly to a small chin. Every shape shares the cranium, the ear and the
 * rows the eyes, nose and mouth sit on (face.ts), so hair and faces fit every shape; only the jaw changes.
 * Portrait: the head is turned three-quarters to our left. The far cheek is the face's left edge (x = 18), the
 * middle of the face runs down about x = 26, the cheek reaches back to the ear (x = 42-44), and the jaw's corner
 * sits under the ear at mouth level, so a short jawline runs forward to the chin (bottom row 39).
 * Chibi: facing front (toward us), symmetric around x = 16, chin at row 19. Facing back it's the back of the head
 * and the ears; facing side (to the left), one profile for every face shape, small enough that the jaw doesn't show.
 * Battle: from behind, the head is all hair (hair/back.ts), so face shapes draw nothing there.
 */
import { ink, type Art, type Piece } from "./art.js";
import {
  BASE, DEEP, SHADOW, both, ellipse, farSide, gridMask, mirror, polygon, rect, shift, spans, symmetric, union,
  type Ink, type Mask, type Point,
} from "./pixels.js";

const C = 32;
const skin = ink("skin", BASE);
const LEGEND: Record<string, Ink> = { b: skin, s: ink("skin", SHADOW), d: ink("skin", DEEP), r: ink("blush", SHADOW) };

/** Hidden under the hair, but it fills every gap between locks. */
const CRANIUM = both(ellipse(33.5, 17, 16, 14), (_x, y) => y <= 26);
/** From the hairline to the cheekbones, the same on every face shape. */
const UPPER_FACE = spans(13, Array.from({ length: 16 }, () => [18, 41] as const));
const JAW_TOP = 29;
const EAR = ["bb.", "bbb", "sdb", "sbb", "sbb", "bsb", ".b."];
const NOSE = { x: 24, y: 30 }, BLUSH_ROW = 29;

const CHIBI_CRANIUM = ellipse(16, 11, 8.2, 7.6);
const CHIBI_EARS = mirror(rect(7, 12, 7, 13), C);
/** The chibi's head facing side (left): brow, nose, lips and chin. */
const CHIBI_PROFILE = union(ellipse(17, 11, 8.2, 7.6), polygon([
  [9.2, 8], [8.4, 12.6], [7.6, 14], [8.4, 15], [8.5, 16.4], [9.8, 18.3], [12.4, 19.3], [15.8, 19.2], [18.4, 17.4],
  [19, 13], [16, 9],
]));
const CHIBI_SIDE_EAR_GRID = ["NB", "Nn", ".N"];
/** The ear, facing side: short hair leaves it bare (hair/chibi-side.ts). */
export const CHIBI_SIDE_EAR = gridMask(18, 12, CHIBI_SIDE_EAR_GRID);
const EAR_LEGEND: Record<string, Ink> = { N: ink("skin", DEEP), B: skin, n: ink("skin", SHADOW) };

/** A face shape from its jaw: each row's left and right pixel from row 29 down to the chin. */
function faceShape(jaw: readonly (readonly [number, number])[], chibiJaw: readonly Point[]): Art {
  const face: Mask = union(CRANIUM, UPPER_FACE, spans(JAW_TOP, jaw));
  const chibi: Mask = union(CHIBI_CRANIUM, symmetric([[16, 14], [8.2, 12.5], ...chibiJaw], C));
  return {
    portrait: {
      head: (pen) => {
        pen.castShadow(shift(face, 0, 2), "skin"); // the jaw's shadow on the neck
        pen.fill(face, skin);
        pen.grid(42, 20, EAR, LEGEND);
      },
      face: (pen) => {
        pen.dot(NOSE.x, NOSE.y, ink("skin", SHADOW));
        pen.grid(31, BLUSH_ROW, ["r.rr"], LEGEND); // blush under each eye
        pen.grid(19, BLUSH_ROW, ["rr"], LEGEND);
      },
    },
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
  /** Full cheeks down to the mouth, the jaw's corner under the ear, a short jawline to a small round chin. */
  soft: faceShape(
    [[18, 41], [18, 41], [18, 40], [18, 40], [19, 39], [19, 38], [20, 37], [21, 36], [22, 34], [24, 32], [26, 30]],
    [[9.5, 16.5], [12, 18.6], [16, 19.4]],
  ),
  /** Slimmer cheeks, the jaw's corner a row higher, tapering to a narrower chin a row lower. */
  sharp: faceShape(
    [
      [18, 41], [18, 40], [18, 40], [19, 39], [19, 38], [20, 37], [21, 36], [22, 35], [23, 34], [24, 33], [25, 31],
      [26, 29],
    ],
    [[9.4, 16], [12.6, 18.6], [15, 19.4], [16, 19.6]],
  ),
  /** Cheeks straight down to a low jaw corner, a wide flat chin. */
  square: faceShape(
    [[18, 41], [18, 41], [18, 41], [18, 40], [19, 40], [19, 39], [20, 38], [21, 37], [22, 35], [23, 33], [25, 31]],
    [[8.8, 16.8], [10.8, 18.8], [16, 19.4]],
  ),
} as const satisfies Record<string, Art>;
