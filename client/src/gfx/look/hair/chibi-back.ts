/**
 * The chibi's hair styles facing back (walking away from us, up the screen). The whole head is hair: a crown,
 * and locks hanging from it over the back of the head and, for longer styles, the shoulders and back. Drawn
 * and lit like the front (chibi.ts), but nothing falls on a face.
 */
import { ink } from "../art.js";
import { DEEP, both, ellipse, symmetric, union, type Mask, type Pen } from "../pixels.js";
import { crownTo, drawChibiHair, lock, pair, type HairLight, type Style } from "./chibi.js";

const C = 32;

const BEHIND: HairLight = {
  band: { outer: ellipse(16, 11, 7, 6), inner: ellipse(16, 11.6, 5.4, 4.6), belowY: 9, litBefore: 21 },
  onFace: false,
  underRows: 2,
};

/** Down to the nape. */
const NAPE = crownTo(13);
/** The back of the head down to the hairline: where locks part, darker hair shows through, never the scalp. */
const SKULL = both(ellipse(16, 11, 8.2, 7.6), (_x, y) => y <= 17);

/** A style from behind, over the back of the head. */
export function drawChibiFromBehind(pen: Pen, style: Style): void {
  pen.fill(SKULL, ink("hair", DEEP));
  drawChibiHair(pen, style, BEHIND);
}

export const CHIBI_HAIR_BEHIND = {
  short: {
    crown: NAPE,
    locks: [
      pair([10, 7], [7.6, 17.4], 6, -0.6), pair([13, 7], [12, 19], 6, -0.3), lock([16, 7], [16, 19.4], 5),
    ],
  },
  bob: {
    // Blunt, round the head to the jaw.
    crown: union(NAPE, both(symmetric([[16, 3], [9.5, 4], [6.8, 9], [6.4, 15], [7, 19.6], [16, 19.6]], C), below(9))),
    locks: [pair([10, 8], [7.6, 20.6], 6, -0.3), pair([13, 8], [12.4, 21.4], 6, -0.1), lock([16, 8], [16, 21.6], 6)],
  },
  long: {
    crown: NAPE,
    locks: [
      symmetric([[16, 12], [10, 14], [11.8, 17.6], [11.8, 21], [11.4, 24], [12.6, 25.4], [16, 25.6]], C),
      pair([12, 14], [10.8, 25.6], 3.4, -0.3), pair([14, 10], [13.4, 27.2], 4, -0.2), lock([16, 8], [16, 26.2], 4),
    ],
  },
  ponytail: {
    // Short at the nape, tied at the back of the head, the tail down the middle of the back like the battle sprite's.
    crown: NAPE,
    locks: [
      symmetric([[16, 12], [9.6, 12.6], [9.4, 15.4], [11, 17.6], [16, 18]], C), // pulled in to the nape
      pair([10.5, 8], [9.8, 16.4], 4, -0.3),
      lock([16, 10.4], [17, 26.4], 8, 0.9),
    ],
    tie: ellipse(16, 10.8, 2, 1.2),
  },
} as const satisfies Record<string, Style>;

function below(y: number): Mask {
  return (_x, yy) => yy >= y;
}
