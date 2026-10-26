/**
 * A sample piece of gear, to show how gear works: a worn leather jerkin with shoulder guards. It's drawn once
 * per view, in fixed materials (leather, brass), against the body's frame, so it looks the same on everyone
 * and fits every body type.
 */
import { ink, type Art } from "./art.js";
import { above, below, vNeck } from "./outfit.js";
import { BASE, DEEP, LIGHT, SHADOW, both, ellipse, farSide, grow, minus, union } from "./pixels.js";

export const LEATHER_JERKIN: Art = {
  portrait: {
    torsowear: (pen, { torso, middle, collarY, waistY }) => {
      const vest = minus(both(grow(torso), both(below(collarY), above(waistY - 1))), vNeck(middle, collarY - 1, 12, 6));
      pen.fill(vest, ink("leather", BASE));
      pen.shade(farSide(vest, 7), SHADOW);
      pen.shade(both(vest, (x, y) => !vest(x, y - 1) || !vest(x - 1, y) || !vest(x + 1, y)), LIGHT); // worn edges
      for (let y = collarY + 4; y < collarY + 12; y += 3) { // laces across the opening
        const half = Math.round(6 - ((y - collarY) * 6) / 12);
        pen.line([middle - half, y], [middle + half + 1, y + 1], ink("leather", DEEP));
      }
    },
    armwear: (pen, { arms, torso, shoulders }) => {
      // Caps over the round of each shoulder, with a rivet.
      const guards = both(grow(union(arms, torso)), union(...shoulders.map(([x, y]) => ellipse(x, y + 2, 6.5, 5.5))));
      pen.fill(guards, ink("leather", BASE));
      pen.shade(farSide(guards, 3), SHADOW);
      pen.shade((x, y) => !guards(x, y - 2), LIGHT); // the light along the top
      for (const [x, y] of shoulders) pen.dot(x, y + 2, ink("brass", LIGHT));
    },
  },
  chibi: {
    torsowear: (pen, { torso, collarY, waistY }) => {
      pen.fill(both(torso, both(below(collarY), above(waistY - 1))), ink("leather", BASE));
      pen.shade((x) => x >= 17, SHADOW);
      pen.dot(15, collarY + 1, ink("brass", LIGHT));
    },
    armwear: (pen, { shoulders }) => {
      for (const [x, y] of shoulders) {
        pen.fill((gx, gy) => Math.abs(gx + 0.5 - x) <= 1.5 && Math.abs(gy + 0.5 - y) <= 1, ink("leather", LIGHT));
      }
    },
  },
};
