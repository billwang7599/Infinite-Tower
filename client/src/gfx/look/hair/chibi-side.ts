/**
 * The chibi's hair styles from the side, facing left (walking right mirrors it). The back of the head is hair,
 * the fringe falls forward over the brow, and shorter styles leave the ear bare (head.ts draws it).
 * Drawn and lit like the front (chibi.ts).
 */
import { CHIBI_SIDE_EAR } from "../head.js";
import { both, ellipse, minus, polygon, union } from "../pixels.js";
import { lock, type HairLight, type Style } from "./chibi.js";

export const SIDEWAYS: HairLight = {
  band: { outer: ellipse(17, 11, 7, 6), inner: ellipse(17.6, 11.6, 5.4, 4.6), belowY: 9, litBefore: 20 },
  onFace: true,
  underRows: 2,
};

const TOP = both(ellipse(16.9, 10.5, 9, 8.4), (_x, y) => y <= 9);
/** The back of the skull, down to the nape. */
const BACK_OF_HEAD = polygon([
  [15, 2], [21, 2.6], [24.8, 6.5], [25.8, 11], [25.2, 15.6], [23.4, 18], [20.8, 18.8], [18.6, 15.6], [17.6, 10.6],
  [15.6, 8.6],
]);
const CROWN = union(TOP, BACK_OF_HEAD);
/** Over the brow, pointing forward. */
const FRINGE = [lock([16, 4], [12.6, 11.8], 5.5, -0.3), lock([13, 4], [8.6, 12.2], 5.5, -0.5)];

/** Leave the ear bare: the hair is tucked behind it. */
const tucked = ({ crown, locks, tie }: Style): Style => ({
  crown: minus(crown, CHIBI_SIDE_EAR), locks: locks.map((l) => minus(l, CHIBI_SIDE_EAR)), tie,
});

export const CHIBI_HAIR_SIDEWAYS = {
  short: tucked({
    crown: CROWN,
    locks: [
      lock([22, 9], [24.8, 18.8], 6, 0.5), lock([19.5, 10], [20.4, 19.6], 5, 0.2), lock([17, 7], [16.4, 14.4], 4, 0.3),
      ...FRINGE,
    ],
  }),
  bob: {
    // Blunt at the jaw, over the ear and the back of the cheek.
    crown: union(CROWN, polygon([[17, 8], [25.4, 9], [26.2, 15], [25.6, 20.4], [15.6, 20.6], [15.2, 16], [16.4, 9]])),
    locks: [
      lock([22, 9], [24.8, 21], 6, 0.3), lock([19.5, 9], [20, 21.4], 5, 0.1), lock([17.2, 8], [15.8, 21], 5, 0),
      ...FRINGE,
    ],
  },
  long: {
    crown: CROWN,
    locks: [
      lock([22, 8], [23.4, 28], 7, 1), lock([19.5, 9], [19.8, 28.6], 6, 0.6), lock([17, 6], [16.2, 22], 5, 0.4),
      ...FRINGE,
    ],
  },
  ponytail: tucked({
    crown: CROWN,
    locks: [
      lock([19.5, 10], [20.4, 18], 5, 0.2), lock([17, 7], [16.4, 14.4], 4, 0.3),
      // Tied high on the back of the head, the tail hanging behind.
      lock([23, 6.5], [27.6, 21], 6.4, 1.6),
      ...FRINGE,
    ],
    tie: ellipse(23.4, 7, 1.4, 2),
  }),
} as const satisfies Record<string, Style>;
