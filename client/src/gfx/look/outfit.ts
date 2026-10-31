/**
 * The starter clothes everyone climbs in. Each is a piece of wear like any future item: drawn once per view
 * against the body's frame (body.ts), so it fits every body type. The tunic takes the player's outfit color
 * ("cloth"); the rest is fixed.
 */
import { ink, type Art, type BattleFrame, type Draw, type Piece } from "./art.js";
import {
  BASE, DEEP, LIGHT, SHADOW, both, farSide, grow, minus, polygon, rect, shift, underside, union, type Mask, type Pen,
} from "./pixels.js";

export const below = (y: number): Mask => (_x, yy) => yy >= y;
export const above = (y: number): Mask => (_x, yy) => yy <= y;
/** A V down the chest from `middle`, its top `half` pixels each side at `top`, its point `depth` rows lower. */
export const vNeck = (middle: number, top: number, depth: number, half: number): Mask =>
  polygon([[middle - half, top], [middle + 0.5, top + depth], [middle + half + 1, top]]);
/** The first and last column `mask` covers on row `y`. */
function columns(mask: Mask, y: number, width: number): [number, number] {
  let first = -1, last = -1;
  for (let x = 0; x < width; x++) if (mask(x, y)) { if (first < 0) first = x; last = x; }
  return [first, last];
}

function battleTunic(pen: Pen, tunic: Mask, middle: number, collarY: number, waistY: number): void {
  const hemY = waistY + 5;
  pen.fill(tunic, ink("cloth", BASE));
  pen.shade(farSide(tunic, 4), SHADOW);
  pen.shade((x, y) => y <= collarY + 2 && x < middle - 1, LIGHT); // across the near shoulder
  pen.shade(below(hemY), DEEP);
  pen.fill(both(tunic, rect(0, hemY, 63, hemY)), ink("accent", BASE));
}

function battleBelt(pen: Pen, torso: Mask, waistY: number): void {
  const belt = both(grow(torso), rect(0, waistY, 63, waistY + 1));
  pen.fill(belt, ink("leather", BASE));
  pen.shade(above(waistY), LIGHT, "leather");
  pen.shade(farSide(belt, 2), SHADOW, "leather");
}

const battleSleeves: Draw<BattleFrame> = (pen, { arms, hands, middle, armpitY }) => {
  pen.fill(arms, ink("cloth", BASE));
  pen.shade((x) => x > middle, SHADOW);
  pen.shade(farSide(arms, 1), DEEP);
  pen.shade((x, y) => x < middle && !arms(x - 1, y) && y < armpitY + 4, LIGHT);
  pen.shade(grow(minus(hands, arms)), DEEP); // the cuff, round the wrist
};

/**
 * A plain tunic over a linen shirt, belted. Cel-shaded with the light from our left: the near side of the chest and
 * the near arm in shadow. The portrait has none: there the bodysuit traced with the body (body.ts) is the clothing.
 */
const TUNIC: Art = {
  chibi: {
    front: {
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
    back: {
      torsowear: (pen, { torso, neck, middle, collarY, waistY }) => {
        pen.fill(union(torso, both(grow(neck), rect(0, collarY - 1, 31, collarY))), ink("cloth", BASE));
        pen.shade((x) => x > middle, SHADOW);
        pen.fill(both(grow(torso), rect(0, waistY, 31, waistY)), ink("leather", BASE));
        for (const y of [waistY - 2, waistY + 1]) pen.dot(middle, y, ink("cloth", DEEP)); // the back seam
      },
      armwear: (pen, { arms, waistY }) => {
        pen.fill(both(arms, above(waistY)), ink("cloth", BASE));
        pen.shade((x) => x >= 16, SHADOW);
      },
    },
    side: {
      torsowear: (pen, { torso, neck, middle, collarY, waistY }) => {
        pen.fill(torso, ink("cloth", BASE));
        pen.shade((x) => x > middle + 2, SHADOW);
        const [throat] = columns(neck, collarY, 32);
        pen.fill(rect(throat - 1, collarY - 1, throat - 1, collarY), ink("linen", BASE));
        const belt = both(grow(torso), rect(0, waistY, 31, waistY));
        pen.fill(belt, ink("leather", BASE));
        pen.dot(columns(belt, waistY, 32)[0], waistY, ink("brass", BASE));
      },
      armwear: (pen, { arms, waistY }) => {
        const sleeve = both(arms, above(waistY));
        pen.fill(sleeve, ink("cloth", BASE));
        pen.shade(farSide(sleeve, 1), SHADOW);
        pen.shade((_x, y) => y === waistY, DEEP); // the cuff
      },
    },
  },
  battle: {
    // From behind: the collar's back, a belt, the skirt split up the back seam and hemmed in the accent color.
    back: {
      torsowear: (pen, { torso, neck, middle, collarY, waistY }) => {
        const collar = both(grow(neck), rect(0, collarY - 1, 63, collarY));
        const tunic = union(torso, both(grow(torso), below(waistY + 2)), collar);
        battleTunic(pen, tunic, middle, collarY, waistY);
        pen.shade(both(collar, above(collarY - 1)), LIGHT);
        for (let y = waistY + 2; y < waistY + 5; y++) pen.dot(middle, y, ink("cloth", DEEP));
        battleBelt(pen, torso, waistY);
      },
      armwear: battleSleeves,
    },
    front: {
      torsowear: (pen, { torso, middle, collarY, waistY }) => {
        const opening = vNeck(middle - 0.5, collarY - 1, 6, 2.5);
        const tunic = minus(union(torso, both(grow(torso), below(waistY + 2))), opening);
        battleTunic(pen, tunic, middle, collarY, waistY);
        pen.fill(both(opening, below(collarY + 2)), ink("linen", BASE));
        pen.fill((x, y) => tunic(x, y) && y < waistY && (opening(x - 1, y) || opening(x + 1, y)), ink("accent", BASE));
        for (const y of [collarY + 7, collarY + 10]) pen.dot(middle, y, ink("brass", LIGHT));
        battleBelt(pen, torso, waistY);
        pen.fill(rect(middle - 1, waistY, middle, waistY + 1), ink("brass", BASE));
      },
      armwear: battleSleeves,
    },
  },
};

/** The chibi's boots cover the bottom two rows of its legs, and their soles the row under them. */
const ankles = (legs: Mask): Mask => underside(legs, 2);
/** Facing front or back: each leg a pixel further out, the left one left and the right one right. */
const outward = (legs: Mask, middle: number): Mask => (x, y) => (x < middle ? legs(x + 1, y) : legs(x - 1, y));
/** Facing side (left): the near leg is the front three columns of the legs; the far one shows behind it. */
const nearLeg = (legs: Mask): Mask => (x, y) => legs(x, y) && !legs(x - 3, y);

/** Facing front or back the legs stand together: the right one in shadow, a dark line where they meet. */
function twoLegs(pen: Pen, middle: number): void {
  pen.shade((x) => x > middle, SHADOW);
  pen.shade((x) => x === middle, DEEP);
}
const chibiTrousers: Piece = {
  legwear: (pen, { legs, middle }) => {
    pen.fill(minus(legs, ankles(legs)), ink("wool", BASE));
    twoLegs(pen, middle);
  },
};
/** A boot on each leg, side by side, the soles a pixel wider on the outside. */
const chibiBoots: Piece = {
  footwear: (pen, { legs, middle }) => {
    const soles = shift(underside(union(legs, outward(legs, middle)), 1), 0, 1);
    pen.fill(union(ankles(legs), soles), ink("leather", BASE));
    twoLegs(pen, middle);
  },
};

const battleTrousers: Piece<BattleFrame> = {
  legwear: (pen, { legs }) => {
    pen.fill(legs, ink("wool", BASE));
    pen.shade(farSide(legs, 2), SHADOW);
  },
};

const TROUSERS: Art = {
  chibi: {
    front: chibiTrousers,
    back: chibiTrousers,
    side: {
      legwear: (pen, { legs }) => {
        pen.fill(minus(legs, ankles(legs)), ink("wool", BASE));
        pen.shade(minus(legs, nearLeg(legs)), SHADOW); // the far leg, behind the near one
      },
    },
  },
  battle: { back: battleTrousers, front: battleTrousers },
};

const battleBoots: Piece<BattleFrame> = {
  footwear: (pen, { shins }) => {
    pen.fill(shins, ink("leather", BASE));
    pen.shade((x, y) => !shins(x, y - 1), LIGHT); // the tops
    pen.shade(farSide(shins, 2), SHADOW);
    pen.shade(underside(shins, 1), DEEP);
  },
};

const BOOTS: Art = {
  chibi: {
    front: chibiBoots,
    back: chibiBoots,
    side: {
      // A boot on each leg, heels flush with the backs of the legs. The near boot's toe points forward (left),
      // sloping down to the sole, and hides the far one's.
      footwear: (pen, { legs }) => {
        const near = nearLeg(legs), heel = underside(near, 1);
        const nearBoot = union(ankles(near), shift(heel, -1, 0), shift(heel, -2, 1), shift(heel, 0, 1));
        const boots = union(ankles(legs), shift(underside(legs, 1), 0, 1), nearBoot);
        pen.fill(boots, ink("leather", BASE));
        pen.shade(minus(boots, nearBoot), SHADOW); // the far boot
      },
    },
  },
  battle: { back: battleBoots, front: battleBoots },
};

export type Wear = Readonly<Record<string, Art>>;
export const STARTER_CLOTHES: Wear = { trousers: TROUSERS, boots: BOOTS, tunic: TUNIC };
