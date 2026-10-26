/**
 * The sword, in the battle sprite: drawn along the pose's grip-to-tip line (battle.ts), so each pose places it.
 * A steel blade, a brass guard and pommel, a leather grip. It's under the arms, so a fist closes over the grip.
 * Everyone's is the same until there are weapons to pick.
 */
import { ink, type Art } from "./art.js";
import { BASE, LIGHT, SHADOW, polygon, type Point } from "./pixels.js";

type Span = readonly [from: number, to: number];

/** Where each part runs along the sword, in pixels from the middle of the grip, and its half-width. */
const POMMEL: Span = [-4.2, -2.6], GRIP: Span = [-3, 2], GUARD: Span = [1.8, 3.2], BLADE_FROM = 3;
const POMMEL_HALF = 1.2, GRIP_HALF = 0.9, GUARD_HALF = 3, BLADE_HALF = 1.6;
/** The blade narrows to its point over this many pixels. */
const POINT = 3;

export const SWORD: Art = {
  battle: {
    weapon: (pen, { sword: [[gx, gy], [tx, ty]] }) => {
      const length = Math.hypot(tx - gx, ty - gy);
      const ux = (tx - gx) / length, uy = (ty - gy) / length;
      /** `along` the sword from the grip, `across` it: positive is the blade's left, held point up. */
      const at = (along: number, across: number): Point =>
        [gx + ux * along + uy * across, gy + uy * along - ux * across];
      const bar = ([from, to]: Span, half: number) =>
        polygon([at(from, -half), at(to, -half), at(to, half), at(from, half)]);
      /** The blade from `side` (its middle, 0) to its left edge, up to the point. */
      const blade = (side: number) => polygon([
        at(BLADE_FROM, side), at(length - POINT, side), at(length, 0), at(length - POINT, BLADE_HALF),
        at(BLADE_FROM, BLADE_HALF),
      ]);

      pen.fill(bar(GRIP, GRIP_HALF), ink("leather", BASE));
      pen.fill(bar(POMMEL, POMMEL_HALF), ink("brass", BASE));
      pen.fill(blade(-BLADE_HALF), ink("steel", BASE));
      pen.shade(blade(0), LIGHT, "steel"); // the half toward the light
      pen.fill(bar(GUARD, GUARD_HALF), ink("brass", BASE));
      pen.shade(bar([GUARD[0], GUARD[0] + 0.7], GUARD_HALF), SHADOW, "brass");
    },
  },
};
