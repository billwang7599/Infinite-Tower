/**
 * The sword fight's poses (SWORD_POSES, battle.ts), from behind: each frame is the standing frame with the upper
 * body leant and crouched, the arms moved, the sword placed. Points are measured from the shoulders, so every
 * body type fits.
 * We look from behind and above, so a sword pointing forward (away from us) points up the screen, foreshortened,
 * and what's in front of the body (a hand reaching across the chest, a blade in front of the face) is hidden by it:
 * a swing shows where the blade comes out from behind the body. From the front (mirrored after, in battle.ts) the
 * same pose shows what's in front of the body over it.
 */
import type { BattleFacing, BattleFrame, Layer } from "./art.js";
import type { BattleBuild, SwordPose } from "./battle.js";
import { both, ellipse, grow, limb, minus, union, type Mask, type Point } from "./pixels.js";

const W = 64, M = 32;
/** The shoulder joints' row; the upper body leans from the hips (not at all) to it (all the way). */
const SHOULDER_Y = 34.4, HIPS_Y = 50;

/** One frame, in pixels. */
interface Key {
  /** The sword hand, from its shoulder (our right), and the sword's tip, from the hand. */
  hand: Point;
  tip: Point;
  /** The sword arm's elbow, from its shoulder, when it's bent. */
  elbow?: Point;
  /** The other hand, from its shoulder; left out, the arm hangs as it does standing. */
  off?: Point;
  /** The sword arm crosses in front of the chest, where the body hides it. */
  hide?: boolean;
  /** "hairBack" when the sword is beyond the body (in front of the player), "headwear" when nearer us than the head. */
  swordLayer?: Layer;
  /** The upper body leant sideways, at the shoulders (+ is our right), and crouched down. */
  lean?: number;
  crouch?: number;
  /** The head, moved from where the body puts it. */
  head?: Point;
  /** Each foot moved, left then right. */
  feet?: readonly [Point, Point];
}

const KEYS: Record<SwordPose, readonly Key[]> = {
  "swing-lr": [
    { hand: [-18, -5], tip: [-17, -5], lean: -2 },
    { hand: [3, -2], tip: [16, -7], swordLayer: "hairBack" },
    { hand: [10, 1], tip: [12, 5], lean: 2 },
  ],
  "swing-rl": [
    { hand: [9, -3], elbow: [6, 3], tip: [13, -7], lean: 2 },
    { hand: [-17, -3], tip: [-16, -2], swordLayer: "hairBack" },
    { hand: [-16, 4], tip: [-16, 5], hide: true, swordLayer: "hairBack", lean: -2 },
  ],
  "swing-tb": [
    { hand: [7, -10], elbow: [10, -3], tip: [2, -20] },
    { hand: [9, 0], tip: [3, 9] },
    { hand: [8, 11], tip: [2, 16], crouch: 1 },
  ],
  "swing-tlbr": [
    { hand: [-17, -10], tip: [-14, -12], lean: -1 },
    { hand: [2, 0], tip: [15, 4], swordLayer: "hairBack" },
    { hand: [10, 8], tip: [13, 11], lean: 1, crouch: 1 },
  ],
  "swing-trbl": [
    { hand: [7, -9], elbow: [8, -1], tip: [12, -15], lean: 1 },
    { hand: [-14, 1], tip: [-14, 4], swordLayer: "hairBack" },
    { hand: [-16, 7], tip: [-12, 13], hide: true, swordLayer: "hairBack", lean: -1, crouch: 1 },
  ],
  "guard-left": [{ hand: [-18, 1], tip: [-11, -12], lean: -1 }],
  "guard-top": [{ hand: [8, -15], tip: [-22, -2], off: [-8, -15], swordLayer: "headwear", crouch: 1 }],
  "guard-right": [{ hand: [6, 0], elbow: [7, 6], tip: [8, -14], lean: 1 }],
  grab: [{ hand: [5, 7], tip: [8, 12], off: [9, -13], swordLayer: "hairBack", crouch: 2, head: [0, 1] }],
  stagger: [
    { hand: [10, -7], tip: [13, 8], off: [-10, 3], lean: -2, head: [-1, 3], feet: [[0, 0], [1, -2]] },
    { hand: [9, 9], tip: [8, 13], off: [-11, -5], lean: 3, head: [1, 2], feet: [[-2, -3], [1, 0]] },
  ],
};

const add = ([x, y]: Point, [dx, dy]: Point): Point => [x + dx, y + dy];
const left = (mask: Mask): Mask => both(mask, (x) => x < M);

/** An arm from the round of `shoulder` to `hand`, bent at `elbow` if there is one, thinning toward the wrist. */
function arm(b: BattleBuild, shoulder: Point, hand: Point, elbow?: Point): Mask {
  const from = elbow ?? shoulder, len = Math.hypot(hand[0] - from[0], hand[1] - from[1]);
  // It ends in the fist, short of the hand's middle.
  const wrist: Point = [hand[0] - ((hand[0] - from[0]) / len) * 1.5, hand[1] - ((hand[1] - from[1]) / len) * 1.5];
  const round = (at: Point, thick: number) => ellipse(at[0], at[1], thick / 2, thick / 2);
  const upper = round(shoulder, b.arm + 0.6);
  if (!elbow) return union(upper, limb(shoulder, wrist, b.arm + 0.6, b.arm - 0.8));
  return union(upper, limb(shoulder, elbow, b.arm + 0.6, b.arm), round(elbow, b.arm),
    limb(elbow, wrist, b.arm, b.arm - 0.8));
}

/** A blade in front of the player, under the body from behind, is over everything from the front. */
const FRONT_LAYER: Partial<Record<Layer, Layer>> = { hairBack: "headwear" };

function posed(b: BattleBuild, stand: BattleFrame, k: Key, facing: BattleFacing): BattleFrame {
  const lean = k.lean ?? 0, crouch = k.crouch ?? 0;
  const leanAt = (y: number) => lean * Math.min(1, Math.max(0, (HIPS_Y - y) / (HIPS_Y - SHOULDER_Y)));
  const upper = (mask: Mask): Mask => (x, y) => mask(x - leanAt(y - crouch), y - crouch);
  const [lf, rf] = k.feet ?? [[0, 0], [0, 0]];
  // A foot moves its boot with it, the thigh stretching to it; each leg stays on its own side.
  const legs = (mask: Mask): Mask => (x, y) => {
    const [dx, dy] = x < M ? lf : rf, t = Math.min(1, Math.max(0, (y - HIPS_Y) / 5));
    const sx = x - dx * t;
    return (sx < M) === (x < M) && mask(sx, y - dy * t);
  };

  const sx = M - b.shoulder + 1.8; // the left shoulder joint's column, as in slash (battle.ts)
  const right: Point = [W - sx + lean, SHOULDER_Y + crouch], leftShoulder: Point = [sx + lean, SHOULDER_Y + crouch];
  const hand = add(right, k.hand);
  const torso = upper(stand.torso), neck = upper(stand.neck);
  const offArm = k.off ? arm(b, leftShoulder, add(leftShoulder, k.off)) : upper(left(stand.arms));
  const offHand = k.off ? ellipse(...add(leftShoulder, k.off), 2.3, 2) : upper(left(stand.hands));
  let swordArm = arm(b, right, hand, k.elbow && add(right, k.elbow));
  let swordHand = ellipse(hand[0], hand[1], 2.2, 2.1);
  if (k.hide && facing === "back") {
    // All but the round of the shoulder.
    const body = minus(grow(torso), ellipse(right[0], right[1], b.arm * 0.8, b.arm * 0.8));
    swordArm = minus(swordArm, body);
    swordHand = minus(swordHand, body);
  }
  const [hx, hy] = k.head ?? [0, 0];
  return {
    ...stand,
    neck, torso,
    arms: union(offArm, swordArm),
    hands: union(offHand, swordHand),
    legs: legs(stand.legs), feet: legs(stand.feet), shins: legs(stand.shins),
    collarY: stand.collarY + crouch, chestY: stand.chestY + crouch, armpitY: stand.armpitY + crouch,
    waistY: stand.waistY + crouch,
    shoulders: [add(stand.shoulders[0], [lean, crouch]), add(stand.shoulders[1], [lean, crouch])],
    head: [Math.round(lean * 1.2) + hx, crouch + hy],
    sword: [hand, add(hand, k.tip)],
    swordLayer: (facing === "front" && k.swordLayer && FRONT_LAYER[k.swordLayer]) || k.swordLayer || "weapon",
  };
}

/** Facing front, as the poses are before battle.ts mirrors them. */
export function swordPoses(
  b: BattleBuild, stand: BattleFrame, facing: BattleFacing,
): Record<SwordPose, readonly BattleFrame[]> {
  const poses = {} as Record<SwordPose, readonly BattleFrame[]>;
  for (const pose of Object.keys(KEYS) as SwordPose[]) poses[pose] = KEYS[pose].map((k) => posed(b, stand, k, facing));
  return poses;
}
