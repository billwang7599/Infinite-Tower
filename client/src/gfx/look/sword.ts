/**
 * The sword, in the battle sprite: drawn along the pose's grip-to-tip line (battle.ts), so each pose places it.
 * A steel blade, a brass guard and pommel, a leather grip. It's under the arms, so a fist closes over the grip,
 * unless the pose puts it on another layer (`swordLayer`).
 */
import { ink, type Art, type BattleFrame, type Draw, type Layer } from "./art.js";
import { BASE, LIGHT, SHADOW, polygon, type Point } from "./pixels.js";

type Span = readonly [from: number, to: number];

/** Where each part runs along the sword, in pixels from the middle of the grip, and its half-width. */
const POMMEL: Span = [-4.2, -2.6], GRIP: Span = [-3, 2], GUARD: Span = [1.8, 3.2], BLADE_FROM = 3;
const POMMEL_HALF = 1.2, GRIP_HALF = 0.9, GUARD_HALF = 3, BLADE_HALF = 1.6;
/** The blade narrows to its point over this many pixels. */
const POINT = 3;

const sword = (layer: Layer): Draw<BattleFrame> => (pen, frame) => {
  const { sword: [[gx, gy], [tx, ty]], swordLayer = "weapon" } = frame;
  if (swordLayer !== layer) return;
  const length = Math.hypot(tx - gx, ty - gy);
  const ux = (tx - gx) / length, uy = (ty - gy) / length;
  /** `along` the sword from the grip, `across` it: positive is the blade's left, held point up. */
  const at = (along: number, across: number): Point =>
    [gx + ux * along + uy * across, gy + uy * along - ux * across];
  const bar = ([from, to]: Span, half: number) =>
    polygon([at(from, -half), at(to, -half), at(to, half), at(from, half)]);
  /** The blade between two lines along it, `from` and `to` across, up to the point. */
  const blade = (from: number, to: number) => polygon([
    at(BLADE_FROM, from), at(length - POINT, from), at(length, 0), at(length - POINT, to), at(BLADE_FROM, to),
  ]);

  pen.fill(bar(GRIP, GRIP_HALF), ink("leather", BASE));
  pen.fill(bar(POMMEL, POMMEL_HALF), ink("brass", BASE));
  pen.fill(blade(-BLADE_HALF, BLADE_HALF), ink("steel", BASE));
  // The half toward the light (the top left): the left one, unless the blade points down or left.
  pen.shade(ux - uy > 0 ? blade(0, BLADE_HALF) : blade(-BLADE_HALF, 0), LIGHT, "steel");
  pen.fill(bar(GUARD, GUARD_HALF), ink("brass", BASE));
  pen.shade(bar([GUARD[0], GUARD[0] + 0.7], GUARD_HALF), SHADOW, "brass");
};

const held = { hairBack: sword("hairBack"), weapon: sword("weapon"), headwear: sword("headwear") };
export const SWORD: Art = { battle: { back: held, front: held } };
