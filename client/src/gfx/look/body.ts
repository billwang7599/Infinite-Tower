/**
 * Body types. Everyone shares the head (head.ts) so hair and faces fit everyone; below it, each body type is a
 * `Frame` (art.ts) with the same named shapes and landmarks. Gear is drawn against the frame, never against
 * fixed pixels, so one piece of gear fits every body type.
 * Every body type is athletic: shoulders well wider than the neck, sloping down into rounded deltoids. They
 * differ in how much: skinny is lean, wide is built. None of them is heavy.
 * Portrait: head and shoulders, turned three-quarters to our left like the head, so the near shoulder (right)
 * reaches further from the neck than the far one. The picture cuts off across the chest. Each body type's is traced
 * from a Stable Diffusion picture (base.ts), bodysuit and all.
 * Chibi: 32x32. Facing front it's symmetric around x = 16, and facing back it has the same outline;
 * facing side (to the left) the chest is to the left, the near arm hangs over the torso, and the feet point left.
 * Battle: the whole body from behind and from the front, in each pose (battle.ts).
 */
import type { Art, BattleFacing, BattleFrame, Draw, Frame, Frames, Piece } from "./art.js";
import { ink } from "./art.js";
import { TRACED, TRACED_INKS, type Traced } from "./base.js";
import { battleFrames, type BattleBuild, type BattleFrames } from "./battle.js";
import {
  BASE, SHADOW, ellipse, farSide, gridMask, mirror, polygon, rect, symmetric, union, type Mask, type Point,
} from "./pixels.js";

const C = 32;

/** A chibi body: half-widths from the middle (x = 16) and the arms' thickness. */
interface ChibiBuild {
  shoulders: number;
  waist: number;
  arm: number;
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
    legs: mirror(rect(13, 26, 15, 29), C), // together, the left one x 13-15 and the right x 16-18
    middle: 16, collarY: 20, chestY: 22, armpitY: 21, waistY: 24,
    shoulders: [[x(b.shoulders - b.arm / 2), 20.5], [C - x(b.shoulders - b.arm / 2), 20.5]],
  };
}

/** The chibi facing side (left): the medium build, and the others deeper or shallower through the chest. */
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
  front: chibiFrame(b),
  back: chibiFrame(b),
  side: chibiSideFrame(b),
});

const tracedMask = ({ x, y, rows }: Traced, material: string): Mask =>
  gridMask(x, y, rows.map((row) => [...row].map((c) => (TRACED_INKS[c]?.[0] === material ? c : ".")).join("")));

const columnsOf = (mask: Mask, y: number) => Array.from({ length: 64 }, (_, x) => x).filter((x) => mask(x, y));

// The bodysuit is the torso, the bare skin beside it the arms.
function portraitFrame(body: Traced): Frame {
  const cloth = tracedMask(body, "cloth"), skin = tracedMask(body, "skin");
  let collarY = body.y;
  while (columnsOf(cloth, collarY).length < 20) collarY++;
  const chest = columnsOf(cloth, collarY + 10);
  const middle = Math.round((chest[0]! + chest[chest.length - 1]!) / 2);
  const arms: Mask = (x, y) => y >= collarY - 2 && skin(x, y);
  const topMiddle = (side: (x: number) => boolean): Point => {
    for (let y = collarY - 2; ; y++) {
      const xs = columnsOf(arms, y).filter(side);
      if (xs.length) return [Math.round((xs[0]! + xs[xs.length - 1]!) / 2), y];
    }
  };
  return {
    neck: (x, y) => y < collarY && cloth(x, y),
    torso: (x, y) => y >= collarY && cloth(x, y),
    arms,
    legs: () => false,
    middle, collarY, chestY: collarY + 14, armpitY: collarY + 7, waistY: 90,
    shoulders: [topMiddle((x) => x < middle), topMiddle((x) => x > middle)],
  };
}

export const BATTLE_BUILDS = {
  skinny: { shoulder: 7, waist: 4.9, hip: 5.5, arm: 3.4, neck: 1.6 },
  medium: { shoulder: 7.9, waist: 5.4, hip: 6, arm: 3.9, neck: 2.6 },
  wide: { shoulder: 9, waist: 6.2, hip: 6.6, arm: 4.6, neck: 2.6 },
} as const satisfies Record<string, BattleBuild>;

/** Body types. Looks only: they change nothing in play. */
export const BODY_TYPES = {
  skinny: {
    portrait: portraitFrame(TRACED.body.skinny),
    chibi: chibiFrames({ shoulders: 5, waist: 2.6, arm: 2 }),
    battle: battleFrames(BATTLE_BUILDS.skinny),
  },
  medium: {
    portrait: portraitFrame(TRACED.body.medium),
    chibi: chibiFrames({ shoulders: 5.6, waist: 2.6, arm: 2.4 }),
    battle: battleFrames(BATTLE_BUILDS.medium),
  },
  wide: {
    portrait: portraitFrame(TRACED.body.wide),
    chibi: chibiFrames({ shoulders: 6.4, waist: 3, arm: 3 }),
    battle: battleFrames(BATTLE_BUILDS.wide),
  },
} as const satisfies Record<string, Omit<Frames, "battle"> & { battle: Record<BattleFacing, BattleFrames> }>;

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

const BATTLE_ARMS: Draw<BattleFrame> = (pen, { arms, hands }) => {
  const limbs = union(arms, hands);
  pen.fill(limbs, skin);
  pen.shade(farSide(limbs, 1), SHADOW);
};

/** The skin below the head, in whatever body type's frame it's drawn in. Mostly under clothes. */
const BODY: Art = {
  chibi: {
    front: CHIBI,
    back: {
      body: (pen, { neck, torso, legs }) => {
        pen.fill(neck, ink("skin", SHADOW)); // in the hair's shadow
        pen.fill(torso, skin);
        pen.fill(legs, skin);
      },
      arms: CHIBI.arms,
    },
    side: CHIBI,
  },
  battle: {
    back: {
      body: (pen, { neck, torso, legs }) => {
        pen.fill(neck, ink("skin", SHADOW)); // in the hair's shadow
        pen.fill(torso, skin);
        pen.fill(legs, skin);
      },
      arms: BATTLE_ARMS,
    },
    front: {
      body: (pen, { neck, torso, legs }) => {
        pen.fill(union(neck, torso, legs), skin);
      },
      arms: BATTLE_ARMS,
    },
  },
};

const portraitBody = (body: Traced): Piece => ({ body: (pen) => pen.traced(body) });

export const BODIES = {
  skinny: { ...BODY, portrait: portraitBody(TRACED.body.skinny) },
  medium: { ...BODY, portrait: portraitBody(TRACED.body.medium) },
  wide: { ...BODY, portrait: portraitBody(TRACED.body.wide) },
} as const satisfies Record<keyof typeof BODY_TYPES, Art>;
