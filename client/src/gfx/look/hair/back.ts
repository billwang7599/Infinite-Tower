/**
 * The battle sprite's hair, seen from behind, drawn from shapes like the chibi's (chibi.ts): a crown over the
 * back of the skull and locks falling from it. From behind the head is all hair, so the skull (about ellipse
 * (32, 20) in the 64x64 picture, narrowing to the nape) is drawn here too, as the dark hair under the locks;
 * it shows between them. All of it moves with the pose's head. Light from the top left: the underside and the
 * right edge in shadow, a dark line where one lock lies over another, a broken shine band round the crown.
 */
import { ink } from "../art.js";
import {
  BASE, DEEP, LIGHT, SHADOW, SHINE, both, ellipse, minus, shift, symmetric, taper, underside, union,
  type Mask, type Pen, type Point,
} from "../pixels.js";

const W = 64, M = 32;
const lock = taper;
const sym = (half: readonly Point[]) => symmetric(half, W);
const crown = (bottom: number): Mask => both(ellipse(M, 19.4, 12.4, 11.6), (_x, y) => y <= bottom);
const SHINE_BAND = { outer: ellipse(M, 19.5, 10.6, 9.6), inner: ellipse(M, 20.5, 8.4, 7.4), belowY: 16 };
const SKULL = union(
  both(ellipse(M, 20, 10.6, 10.2), (_x, y) => y <= 22),
  sym([[M, 22], [21.6, 22], [22.4, 25], [25, 28.6], [27.5, 30], [M, 30]]),
);

interface Style {
  crown: Mask;
  /** Later locks lie over earlier ones. */
  locks: readonly Mask[];
  /** A ponytail: over everything else, edged dark so it stands off the hair under it, and its tie. */
  tail?: { tail: Mask; tie: Mask };
}

/** The index of the topmost lock covering a pixel, or -1. */
const topLock = (locks: readonly Mask[], x: number, y: number): number => {
  for (let i = locks.length - 1; i >= 0; i--) if (locks[i]!(x, y)) return i;
  return -1;
};

/** The middle of `mask`'s row `y`. */
function tailMiddle(mask: Mask, y: number): number {
  let sum = 0, n = 0;
  for (let x = 0; x < W; x++) if (mask(x, y)) { sum += x; n++; }
  return n ? sum / n : -1;
}

export function drawHairFromBehind(pen: Pen, style: Style, [dx, dy]: Point): void {
  const crown = shift(style.crown, dx, dy);
  const locks = style.locks.map((l) => shift(l, dx, dy));
  const hair = union(crown, ...locks);
  pen.fill(hair, ink("hair", BASE));
  pen.shade(underside(hair, 3), SHADOW);
  pen.shade((x, y) => hair(x, y) && !hair(x + 4, y), SHADOW);
  pen.shade((x, y) => {
    if (crown(x, y)) return false;
    const top = topLock(locks, x, y);
    if (top < 0) return false;
    const around = [topLock(locks, x - 1, y), topLock(locks, x + 1, y), topLock(locks, x, y + 1)];
    return around.some((l) => l >= 0 && l < top);
  }, DEEP);
  const zig = (x: number) => Math.abs((x % 4) - 2);
  const outer = shift(SHINE_BAND.outer, dx, dy), inner = shift(SHINE_BAND.inner, dx, dy);
  const band = both(minus(outer, (x, y) => inner(x, y - zig(x) / 2)), (_x, y) => y <= SHINE_BAND.belowY + dy);
  pen.shade((x, y) => band(x, y) && x < 38, LIGHT);
  pen.shade((x, y) => band(x, y) && x < 30 && !band(x, y + 1) && zig(x) === 2, SHINE);
  pen.fill(minus(shift(SKULL, dx, dy), hair), ink("hair", DEEP));
  if (style.tail) {
    const tail = shift(style.tail.tail, dx, dy), tie = shift(style.tail.tie, dx, dy);
    pen.fill(tail, ink("hair", BASE));
    pen.shade((x, y) => tail(x, y) && !tail(x + 3, y), SHADOW);
    pen.shade((x, y) => tail(x, y) && (!tail(x - 1, y) || !tail(x + 1, y) || !tail(x, y + 1)), DEEP);
    pen.shade((x, y) => tail(x, y) && x === Math.round(tailMiddle(tail, y)) - 1, LIGHT);
    pen.fill(tie, ink("accent", BASE));
    pen.shade((x, y) => tie(x, y) && !tie(x, y - 1), LIGHT);
  }
}

export const BACK_HAIR = {
  /** Spiky, to the nape, a tuft sticking up. */
  short: {
    crown: both(crown(22), sym([[M, 5], [18, 5], [18, 20], [23, 27], [M, 27]])),
    locks: [
      lock([23.5, 14], [20.4, 29], 7, -1), lock([40.5, 14], [43.6, 29], 7, 1),
      lock([27.5, 13], [24.6, 31], 8, -0.8), lock([36.5, 13], [39.4, 31], 8, 0.8),
      lock([30.5, 12], [29.2, 32.2], 7.5, -0.3), lock([34, 12], [35, 31.4], 7, 0.3),
      lock([31, 9], [34, 5.6], 3, -0.8),
    ],
  },
  /** Cut level at the nape, a little wider than the head. */
  bob: {
    crown: crown(18),
    locks: [
      sym([[M, 8], [24, 9], [20.4, 14], [19.6, 21], [19.8, 28], [20.8, 32.4], [23, 33.6], [M, 33.8]]),
      lock([25, 15], [21.6, 33.4], 6, -0.6), lock([39, 15], [42.4, 33.4], 6, 0.6),
      lock([28.5, 14], [26.4, 34], 6, -0.3), lock([35.5, 14], [37.6, 34], 6, 0.3), lock([32, 13], [32, 34.4], 6),
    ],
  },
  /** Rounded in under the skull to the nape, then falling straight, narrower than the shoulders. */
  long: {
    crown: crown(24),
    locks: [
      sym([[M, 21], [21.4, 22], [22.6, 25], [24.2, 29], [24.4, 35], [24, 40], [25.4, 43.6], [M, 44.4]]),
      lock([26, 23], [24.8, 45], 4, -0.4), lock([38, 23], [39.2, 45], 4, 0.4),
      lock([28.5, 19], [28, 47.4], 5, -0.2), lock([35.5, 19], [36, 47.4], 5, 0.2), lock([32, 17], [32, 46], 5),
    ],
  },
  /** Pulled back smooth to a tie high on the back of the head; the tail swings down between the shoulders. */
  ponytail: {
    crown: both(ellipse(M, 19.8, 11.4, 11), (_x, y) => y <= 22),
    locks: [sym([[M, 9], [24, 10], [21.4, 14], [21, 21], [22, 26.5], [25.5, 30], [M, 30.6]])],
    tail: { tail: lock([32, 18], [34.4, 48], 10, 1.8), tie: ellipse(M, 19, 2.8, 1.8) },
  },
} as const satisfies Record<string, Style>;
