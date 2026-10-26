/**
 * The starter clothes everyone climbs in. Each is a piece of wear like any future item: drawn once per view
 * against the body's frame (body.ts), so it fits every body type. The tunic takes the player's outfit color
 * ("cloth"); the rest is fixed.
 */
import { ink, type Art } from "./art.js";
import {
  BASE, DEEP, LIGHT, SHADOW, both, farSide, grow, minus, polygon, rect, type Mask,
} from "./pixels.js";

export const below = (y: number): Mask => (_x, yy) => yy >= y;
export const above = (y: number): Mask => (_x, yy) => yy <= y;
/** A V down the chest from `middle`, its top `half` pixels each side at `top`, its point `depth` rows lower. */
export const vNeck = (middle: number, top: number, depth: number, half: number): Mask =>
  polygon([[middle - half, top], [middle + 0.5, top + depth], [middle + half + 1, top]]);
/** The first and last column `mask` covers on row `y`. */
export function columns(mask: Mask, y: number, width: number): [number, number] {
  let first = -1, last = -1;
  for (let x = 0; x < width; x++) if (mask(x, y)) { if (first < 0) first = x; last = x; }
  return [first, last];
}

/** The collar behind the portrait's neck, standing up from the shoulders: all of it that shows round a V-neck. */
export function backCollar(neck: Mask, collarY: number): Mask {
  const [, back] = columns(neck, collarY - 3, 64);
  return polygon([[back - 1, collarY - 1], [back + 1, collarY - 5], [back + 4, collarY - 4], [back + 4.5, collarY]]);
}

/**
 * A plain tunic, V-necked over a linen shirt, its collar standing up behind the neck, buttoned down the front.
 * Cel-shaded with the light from our left: the near side of the chest and the near arm in shadow, the light
 * along the tops of the shoulders.
 */
export const TUNIC: Art = {
  portrait: {
    torsowear: (pen, { torso, neck, middle, collarY }) => {
      const opening = vNeck(middle, collarY - 4, 10, 5);
      const coat = minus(both(grow(torso), below(collarY - 3)), opening);
      pen.fill(coat, ink("cloth", BASE));
      pen.shade((x) => x > middle + 9, SHADOW);
      pen.shade(farSide(coat, 3), DEEP);
      pen.shade((x, y) => x <= middle + 9 && !coat(x, y - 2), LIGHT);
      // The placket down the front, and its buttons.
      pen.shade((x, y) => x === middle + 1 && y > collarY + 5, DEEP);
      for (const y of [collarY + 10, collarY + 16]) pen.dot(middle, y, ink("brass", LIGHT));
      // The linen shirt in the bottom of the V, open at the throat.
      pen.fill(minus(both(opening, below(collarY + 1)), vNeck(middle, collarY - 4, 8, 2)), ink("linen", BASE));
      pen.shade(both(opening, farSide(opening, 2)), SHADOW);
      // Accent piping down both edges of the V: the one bright color on the clothes.
      pen.fill((x, y) => coat(x, y) && (opening(x - 1, y) || opening(x + 1, y)), ink("accent", BASE));
      const collar = backCollar(neck, collarY);
      pen.fill(collar, ink("cloth", LIGHT));
      pen.shade(farSide(collar, 2), BASE);
    },
    armwear: (pen, { arms, middle, armpitY }) => {
      pen.fill(arms, ink("cloth", BASE)); // long sleeves, past the bottom of the picture
      pen.blend(above(armpitY)); // sewn into the shoulder: no seam over the top of the arm
      pen.shade((x) => x > middle + 9, SHADOW);
      pen.shade(farSide(arms, 2), DEEP);
    },
  },
  chibi: {
    torsowear: (pen, { torso, collarY, waistY }) => {
      pen.fill(torso, ink("cloth", BASE));
      pen.shade((x) => x >= 17, SHADOW);
      pen.fill(rect(15, collarY, 16, collarY + 1), ink("linen", BASE));
      pen.fill(both(torso, rect(0, waistY, 31, waistY)), ink("leather", BASE));
      pen.dot(15, waistY, ink("brass", BASE));
      pen.dot(16, waistY, ink("brass", BASE));
    },
    armwear: (pen, { arms, waistY }) => {
      pen.fill(both(arms, above(waistY)), ink("cloth", BASE));
      pen.shade((x) => x >= 16, SHADOW);
    },
  },
};

export const TROUSERS: Art = {
  chibi: { legwear: (pen, { legs }) => pen.fill(both(legs, above(27)), ink("wool", BASE)) },
};

export const BOOTS: Art = {
  chibi: { footwear: (pen, { legs }) => pen.fill(both(grow(legs), below(28)), ink("leather", BASE)) },
};

export const STARTER_CLOTHES: readonly Art[] = [TROUSERS, BOOTS, TUNIC];
