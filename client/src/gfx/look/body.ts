/**
 * Body types. Everyone shares the head (head.ts) so hair and faces fit everyone; below it, each body type is a
 * `Frame` (art.ts) with the same named shapes and landmarks. Gear is drawn against the frame, never against
 * fixed pixels, so one piece of gear fits every body type.
 * Every body type is athletic: shoulders well wider than the neck, sloping down into rounded deltoids. They
 * differ in how much: skinny is lean, wide is built. None of them is heavy.
 * Portrait: head and shoulders, turned three-quarters to our left like the head, so the near shoulder (right)
 * reaches further from the neck than the far one. The picture cuts off across the chest.
 * Chibi: 32x32, facing us, symmetric around x = 16. From behind it has the same outline; from the side (facing
 * left) the chest is to the left, the near arm hangs over the torso, and the feet point left.
 * Battle: the whole body from behind, in each pose (battle.ts).
 */
import type { Art, BattleFrame, Frame, Frames, Piece } from "./art.js";
import { ink } from "./art.js";
import { battleFrames, type Pose } from "./battle.js";
import {
  BASE, SHADOW, ellipse, farSide, mirror, polygon, rect, symmetric, union, type Point,
} from "./pixels.js";

const C = 32;
/** The breastbone's column in the portrait: body types widen out from it. */
const MIDDLE = 33;
const COLLAR_Y = 45;

/** The medium build's outline, from the throat round the far shoulder, along the bottom and back up to the nape. */
const TORSO: readonly Point[] = [
  [29.5, 44], [27, 45.5], [21, 47.5], [14, 49.5], [9, 52], [6, 55], [4, 60], [3, 64], [64, 64], [62, 58],
  [60.5, 53], [57.5, 49.5], [53, 47], [46, 44.5], [40.5, 42],
];
/** The far and near arms below the round of each shoulder. */
const ARMS: readonly (readonly Point[])[] = [
  [[9, 52], [6, 55], [4, 60], [3, 64], [12.5, 64], [12, 59], [13, 54]],
  [[57.5, 49.5], [60.5, 53], [62, 58], [64, 64], [53, 64], [53, 59], [54, 53]],
];

/** A portrait body: how much wider than medium its shoulders are, and its neck's front and back columns. */
interface Build {
  width: number;
  neck: readonly [front: number, back: number];
}

/** A chibi body: half-widths from the middle (x = 16) and the arms' thickness. */
interface ChibiBuild {
  shoulders: number;
  waist: number;
  arm: number;
}

function portraitFrame({ width, neck: [front, back] }: Build): Frame {
  const widen = (points: readonly Point[]) => points.map(([x, y]) => [MIDDLE + (x - MIDDLE) * width, y] as const);
  const at = (x: number, y: number): Point => [Math.round(MIDDLE + (x - MIDDLE) * width), y];
  const arms = ARMS.map((arm) => polygon(widen(arm)));
  return {
    neck: polygon([[front, 28], [back, 26], [back + 0.5, 43], [front, 48]]),
    torso: polygon(widen(TORSO)),
    arms: (x, y) => arms.some((arm) => arm(x, y)),
    legs: () => false,
    middle: MIDDLE, collarY: COLLAR_Y, chestY: 60, armpitY: 56, waistY: 90,
    shoulders: [at(9, 51), at(56, 49)],
  };
}

function chibiFrame(b: ChibiBuild): Frame {
  const x = (half: number) => 16 - half;
  const arm: Point[] = [
    [x(b.shoulders - b.arm + 0.4), 19.8], [x(b.shoulders - 0.6), 20.2], [x(b.shoulders), 21.2], [x(b.shoulders), 25.6],
    [x(b.shoulders - b.arm), 25.6], [x(b.shoulders - b.arm), 21.6],
  ];
  return {
    neck: rect(14, 18, 17, 20),
    torso: symmetric([[16, 19.6], [x(b.shoulders - b.arm), 19.7], [x(b.waist), 23], [x(b.waist), 26], [16, 26]], C),
    arms: mirror(polygon(arm), C),
    legs: mirror(rect(13, 26, 14, 29), C),
    middle: 16, collarY: 20, chestY: 22, armpitY: 21, waistY: 24,
    shoulders: [[x(b.shoulders - b.arm / 2), 20.5], [C - x(b.shoulders - b.arm / 2), 20.5]],
  };
}

/** The chibi from the side, facing left: the medium build, and the others deeper or shallower through the chest. */
function chibiSideFrame(b: ChibiBuild): Frame {
  const d = (b.shoulders - 5.6) / 2, a = (b.arm - 2.4) / 2;
  const arm = polygon([
    [14.4 - a, 19.9], [17.6 + a, 19.9], [18.1 + a, 21.4], [17.8 + a, 24.4], [14.8 - a, 24.4], [14.2 - a, 21.4],
  ]);
  return {
    neck: rect(14, 18, 16, 20),
    torso: polygon([
      [12.8 - d, 19.8], [18.8 + d, 19.6], [19.6 + d, 21.4], [19.2 + d, 26], [12.8 - d / 2, 26], [12.2 - d, 22.4],
    ]),
    arms: union(arm, ellipse(16.2, 25, 1.6 + a / 2, 1.4)),
    legs: rect(13, 26, 17, 29),
    middle: 15, collarY: 20, chestY: 22, armpitY: 21, waistY: 24,
    shoulders: [[16, 20.5], [16, 20.5]],
  };
}

/** The chibi's frames: front and back share an outline. */
const chibiFrames = (b: ChibiBuild) => ({
  chibi: chibiFrame(b),
  chibiBack: chibiFrame(b),
  chibiSide: chibiSideFrame(b),
});

/** Body types. Looks only: they change nothing in play. */
export const BODY_TYPES = {
  skinny: {
    portrait: portraitFrame({ width: 0.86, neck: [30.5, 38] }),
    ...chibiFrames({ shoulders: 5, waist: 2.6, arm: 2 }),
    battle: battleFrames({ shoulder: 7, waist: 4.9, hip: 5.5, arm: 3.4, neck: 1.6 }),
  },
  medium: {
    portrait: portraitFrame({ width: 1, neck: [30, 38.5] }),
    ...chibiFrames({ shoulders: 5.6, waist: 2.6, arm: 2.4 }),
    battle: battleFrames({ shoulder: 7.9, waist: 5.4, hip: 6, arm: 3.9, neck: 2.6 }),
  },
  wide: {
    portrait: portraitFrame({ width: 1.1, neck: [29, 39.5] }),
    ...chibiFrames({ shoulders: 6.4, waist: 3, arm: 3 }),
    battle: battleFrames({ shoulder: 9, waist: 6.2, hip: 6.6, arm: 4.6, neck: 2.6 }),
  },
} as const satisfies Record<string, Omit<Frames, "battle"> & { battle: Record<Pose, BattleFrame> }>;
export type BodyType = keyof typeof BODY_TYPES;

const skin = ink("skin", BASE);

const CHIBI: Piece = {
  body: (pen, frame) => {
    pen.fill(frame.neck, skin);
    pen.fill(frame.torso, skin);
    pen.fill(frame.legs, skin);
    pen.shade(farSide(frame.torso, 1), SHADOW);
  },
  arms: (pen, frame) => {
    pen.fill(frame.arms, skin);
    pen.shade(farSide(frame.arms, 1), SHADOW);
  },
};

/** The skin below the head, in whatever body type's frame it's drawn in. Mostly under clothes. */
export const BODY: Art = {
  portrait: {
    body: (pen, frame) => {
      pen.fill(frame.neck, skin);
      pen.shade(farSide(frame.neck, 3), SHADOW); // the back of the neck, turned from the light
      pen.fill(frame.torso, skin);
    },
    arms: (pen, frame) => {
      pen.fill(frame.arms, skin);
      pen.blend((_x, y) => y <= frame.armpitY); // the shoulder is one shape with the arm
      pen.shade(farSide(frame.arms, 3), SHADOW);
    },
  },
  chibi: CHIBI,
  chibiBack: {
    body: (pen, { neck, torso, legs }) => {
      pen.fill(neck, ink("skin", SHADOW)); // in the hair's shadow
      pen.fill(torso, skin);
      pen.fill(legs, skin);
    },
    arms: CHIBI.arms,
  },
  chibiSide: CHIBI,
  battle: {
    body: (pen, { neck, torso, legs }) => {
      pen.fill(neck, ink("skin", SHADOW)); // in the hair's shadow
      pen.fill(torso, skin);
      pen.fill(legs, skin);
    },
    arms: (pen, { arms, hands }) => {
      const limbs = union(arms, hands);
      pen.fill(limbs, skin);
      pen.shade(farSide(limbs, 1), SHADOW);
    },
  },
};
