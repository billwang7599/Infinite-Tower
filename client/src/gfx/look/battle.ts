/**
 * The battle sprite's body, from behind, in each pose. A pose is a `BattleFrame` (art.ts): the standing body's
 * shapes, moved. Hair, clothes and the sword are drawn against the frame, so they follow every pose and fit
 * every body type, as in the other views.
 * 64x64: the figure is 48 wide around x = 32, its feet on the bottom row; the 8 columns each side are for the
 * sword. We see the player from behind, so their right hand is on our right. Light from the top left.
 */
import type { BattleFrame } from "./art.js";
import { ellipse, mirror, polygon, shift, symmetric, union, type Mask, type Point } from "./pixels.js";

/**
 * stand: arms down, the sword held up and out. slash: the sword arm swung out to our right, the blade beyond it
 * (never mirrored: every swing's trail starts on this side, battle/player/pose.ts). down: knelt and slumped, head
 * hanging, the sword dropped beside them.
 */
export const POSES = ["stand", "slash", "down"] as const;
export type Pose = (typeof POSES)[number];

const W = 64, M = 32;
const sym = (half: readonly Point[]) => symmetric(half, W);
const mir = (mask: Mask) => mirror(mask, W);

/** A body type, from behind: half-widths from the middle, and how thick the arms and neck are. */
export interface BattleBuild {
  shoulder: number;
  waist: number;
  hip: number;
  arm: number;
  neck: number;
}

/** A straight limb from `a` to `b`, `thickA` thick at `a` and `thickB` at `b`. */
function limb(a: Point, b: Point, thickA: number, thickB: number): Mask {
  const [ax, ay] = a, [bx, by] = b;
  const len = Math.hypot(bx - ax, by - ay);
  const nx = -(by - ay) / len, ny = (bx - ax) / len;
  const side = (x: number, y: number, half: number, s: number): Point => [x + nx * half * s, y + ny * half * s];
  return polygon([side(ax, ay, thickA / 2, 1), side(bx, by, thickB / 2, 1), side(bx, by, thickB / 2, -1),
    side(ax, ay, thickA / 2, -1)]);
}

export function battleFrames(b: BattleBuild): Record<Pose, BattleFrame> {
  const s = b.shoulder, wrist = M - s - 2.3;
  /** The left hand's middle; the right hand's is its mirror image, W - handX. */
  const handX = wrist + (b.arm - 0.7) / 2;
  const leftArm = polygon([
    [M - s + 2.2, 33.2], [M - s - 0.1, 33.8], [M - s - 1.3, 35.6], [M - s - 1.8, 40], [wrist, 45.6],
    [wrist + b.arm - 0.7, 45.6], [M - s - 1.8 + b.arm, 40.2], [M - s + b.arm - 0.6, 36.4],
  ]);
  const leftHand = ellipse(handX, 47.2, 2.3, 2);
  const hips = sym([[M, 48], [M - b.hip + 0.2, 48], [M - b.hip + 0.1, 51.4], [M, 52.2]]);
  const leg = polygon([[M - b.hip + 0.1, 50], [M - 0.5, 50], [M - 0.6, 61.5], [M - b.hip + 0.6, 61.5]]);
  const feet = mir(ellipse(M - b.hip / 2 - 0.6, 62.6, 2.8, 1.7));
  // A boot is a pixel wider than the shin, on the inside.
  const shin: Mask = (x, y) => leg(x, y) || leg(x + 1, y);

  const stand: BattleFrame = {
    neck: sym([[M, 29], [M - b.neck, 29], [M - b.neck, 34], [M, 34]]),
    torso: sym([
      [M, 32.4], [M - 3, 32.6], [M - s + 2.6, 33.3], [M - s + 0.8, 34.5], [M - s + 0.6, 36], [M - s + 1.3, 38.6],
      [M - b.waist, 42.6], [M - b.waist, 45.4], [M - b.hip, 49.6], [M, 49.6],
    ]),
    arms: mir(leftArm),
    hands: mir(leftHand),
    legs: union(hips, mir(leg)),
    feet,
    shins: union(mir((x, y) => shin(x, y) && y >= 56), feet),
    middle: M, collarY: 32, chestY: 38, armpitY: 37, waistY: 44,
    shoulders: [[M - s + 1.5, 33], [W - (M - s + 1.5), 33]],
    head: [0, 0],
    sword: [[W - handX, 47.2], [W - handX + 7, 26]],
  };

  // Slash: the right arm straight out from the shoulder, a little below it; the blade beyond, swung forward (up,
  // seen from behind and above).
  const shoulder: Point = [W - (M - s + 1.8), 34.4], hand: Point = [W - (M - s - 7.5), 37.8];
  const slash: BattleFrame = {
    ...stand,
    arms: union(leftArm, limb(shoulder, [hand[0] - 1.6, hand[1] - 0.1], b.arm + 0.6, b.arm - 0.8)),
    hands: union(leftHand, ellipse(hand[0], hand[1], 2.2, 2.1)),
    sword: [hand, [hand[0] + 12, hand[1] - 16]],
  };

  // Down: sat back on the heels, so the hips drop to them and only the soles show below; slumped, so the head
  // hangs lower still, between the shoulders. Arms limp, the hands near the ground.
  const drop = (mask: Mask) => shift(mask, 0, 9);
  const soles = mir(ellipse(M - b.hip / 2 - 0.4, 61.6, 2.6, 2));
  const down: BattleFrame = {
    ...stand,
    neck: drop(stand.neck), torso: drop(stand.torso), arms: drop(stand.arms), hands: drop(stand.hands),
    legs: drop(hips),
    feet: soles,
    shins: soles,
    collarY: 41, chestY: 47, armpitY: 46, waistY: 53,
    shoulders: [[stand.shoulders[0][0], 42], [stand.shoulders[1][0], 42]],
    head: [0, 14],
    sword: [[M + 13, 61.5], [M + 29, 57.5]],
  };
  return { stand, slash, down };
}
