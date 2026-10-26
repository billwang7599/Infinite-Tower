/**
 * The chibi's hair styles, drawn from shapes: a back mass behind the head, a crown, and pointed locks over it.
 * Cel-shaded with light from the top left: the underside and the far side in shadow, a dark line where one lock
 * lies over another, a broken shine band round the crown, and the locks' shadow on the forehead.
 */
import { ink } from "../art.js";
import {
  BASE, DEEP, LIGHT, SHADOW, SHINE, both, ellipse, minus, rect, shift, symmetric, taper, underside, union,
  type Mask, type Pen, type Point,
} from "../pixels.js";

const C = 32;
const lock = taper;
const pair = (root: Point, tip: Point, w: number, bend = 0): Mask =>
  union(lock(root, tip, w, bend), lock([C - root[0], root[1]], [C - tip[0], tip[1]], w, -bend));

interface Style {
  back?: Mask;
  crown: Mask;
  /** Later locks lie over earlier ones. */
  locks: readonly Mask[];
}

const SHINE_BAND = { outer: ellipse(16, 11, 7, 6), inner: ellipse(16, 11.6, 5.4, 4.6), belowY: 8, tooth: 1 };
const crown = (bottom: number) => both(ellipse(16, 10.6, 9, 8.4), (_x, y) => y <= bottom);

/** The index of the topmost lock covering a pixel, or -1. */
const topLock = (locks: readonly Mask[], x: number, y: number): number => {
  for (let i = locks.length - 1; i >= 0; i--) if (locks[i]!(x, y)) return i;
  return -1;
};

export function drawChibiBack(pen: Pen, { back }: Style): void {
  if (!back) return;
  pen.fill(back, ink("hair", SHADOW));
  pen.shade(underside(back, 3), DEEP);
}

export function drawChibiFront(pen: Pen, { crown, locks }: Style): void {
  const front = union(crown, ...locks);
  pen.castShadow(shift(front, 0, 1), "skin");
  pen.fill(front, ink("hair", BASE));
  pen.shade(underside(front, 3), SHADOW);
  pen.shade((x, y) => front(x, y) && !front(x + 3, y), SHADOW);
  // Where one lock lies over another, its edge is a dark strand line.
  pen.shade((x, y) => {
    if (crown(x, y)) return false;
    const top = topLock(locks, x, y);
    if (top < 0) return false;
    const around = [topLock(locks, x - 1, y), topLock(locks, x + 1, y), topLock(locks, x, y + 1)];
    return around.some((l) => l >= 0 && l < top);
  }, DEEP);
  const { outer, inner, belowY, tooth } = SHINE_BAND;
  const zig = (x: number) => Math.abs((x % (2 * tooth)) - tooth);
  const band = both(minus(outer, (x, y) => inner(x, y - zig(x))), (_x, y) => y < belowY);
  pen.shade((x, y) => band(x, y) && x < 21, LIGHT);
  pen.shade((x, y) => band(x, y) && x < 16 && !band(x, y + 1) && zig(x) === tooth, SHINE);
}

export const CHIBI_HAIR = {
  short: {
    back: symmetric([[16, 2], [10, 3], [7, 7], [6.6, 12], [7.5, 17], [16, 17]], C),
    crown: crown(7),
    locks: [
      lock([9, 6], [7.5, 16], 5, -0.5), lock([23, 6], [24.5, 16], 5, 0.5), lock([20, 5], [21, 13.5], 5),
      lock([12, 5], [10.5, 13.5], 5), lock([16, 5], [15, 13], 5),
    ],
  },
  bob: {
    back: symmetric([[16, 2], [10, 3], [6.5, 8], [6, 14], [6.5, 20], [9, 21.5], [16, 21]], C),
    crown: union(crown(8), rect(8, 6, 23, 11)),
    locks: [pair([8.5, 8], [9.5, 21], 4.5, 0.5)],
  },
  long: {
    back: symmetric([[16, 2], [10, 3], [6.5, 8], [6, 16], [5.5, 26], [7, 28], [16, 28]], C),
    crown: crown(6),
    locks: [pair([8.5, 8], [8, 27], 3.5, 0.6), pair([15.5, 4], [10, 14], 6, 0.6)],
  },
  ponytail: {
    back: union(
      symmetric([[16, 2], [10, 3], [7, 7], [6.8, 12], [8, 16], [16, 16]], C), lock([20, 3], [27.5, 19], 11, 2),
    ),
    crown: crown(7),
    locks: [
      lock([10, 5], [8, 15], 5, -0.5), lock([23, 6], [24, 14], 4.5, 0.4), lock([18, 4], [16, 12.5], 6, -0.8),
      lock([14, 4], [11, 13], 6, -0.8),
    ],
  },
} as const satisfies Record<string, Style>;
