import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_LOOK, LOOK_OPTIONS } from "@infinite-tower/shared";
import { BATTLE_FACINGS, VIEWS, type Art, type Picture } from "../../src/gfx/look/art.js";
import { POSES, SWORD_POSES, type SwordPose } from "../../src/gfx/look/battle.js";
import { BODY_TYPES } from "../../src/gfx/look/body.js";
import { LEATHER_JERKIN } from "../../src/gfx/look/jerkin.js";
import { CHIBI_FACINGS, drawBattle, drawChibi, drawPortrait } from "../../src/gfx/look/look.js";
import { STARTER_CLOTHES } from "../../src/gfx/look/outfit.js";
import { EYES, FIXED } from "../../src/gfx/look/palette.js";
import { BASE, LIGHT } from "../../src/gfx/look/pixels.js";

const WEARS: Record<string, readonly Art[]> = {
  "starter clothes": STARTER_CLOTHES,
  "with the jerkin": [...STARTER_CLOTHES, LEATHER_JERKIN],
};

/** Every picture of the default look in `wear`, with the view it's drawn in. */
const pictures = (wear: readonly Art[]) => [
  { name: "portrait", view: VIEWS.portrait, pic: drawPortrait(DEFAULT_LOOK, wear) },
  ...CHIBI_FACINGS.map((facing) => ({
    name: `chibi ${facing}`, view: VIEWS.chibi, pic: drawChibi(DEFAULT_LOOK, facing, wear),
  })),
  ...BATTLE_FACINGS.flatMap((facing) => POSES.map((pose) => ({
    name: `battle ${pose} ${facing}`, view: VIEWS.battle, pic: drawBattle(DEFAULT_LOOK, pose, 0, facing, wear),
  }))),
];

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const hexAt = (pic: Picture, i: number) =>
  `#${[0, 1, 2].map((c) => pic.rgba[i * 4 + c]!.toString(16).padStart(2, "0")).join("")}`;

const opaquePixels = (pic: Picture) =>
  Array.from({ length: pic.width * pic.height }, (_, i) => pic.rgba[i * 4 + 3]).filter((a) => a === 255).length;

describe("look pictures", () => {
  test("there are three views: the portrait, the chibi and the battle sprite", () => {
    assert.deepEqual(Object.keys(VIEWS), ["portrait", "chibi", "battle"]);
  });

  for (const [wearName, wear] of Object.entries(WEARS)) {
    test(`each is drawn at its view's size (${wearName})`, () => {
      for (const { name, view, pic } of pictures(wear)) {
        assert.equal(pic.width, view.width, name);
        assert.equal(pic.height, view.height, name);
        assert.equal(pic.rgba.length, pic.width * pic.height * 4, name);
      }
    });

    test(`each has something drawn (${wearName})`, () => {
      for (const { name, pic } of pictures(wear)) assert.ok(opaquePixels(pic) > 0, `${name}: nothing drawn`);
    });
  }
});

describe("the sword fight's poses", () => {
  test("a swing has a wind-up, a strike and a follow-through; a guard and a grab one frame, a stagger two", () => {
    assert.deepEqual(SWORD_POSES, {
      "swing-lr": 3, "swing-rl": 3, "swing-tb": 3, "swing-tlbr": 3, "swing-trbl": 3,
      "guard-left": 1, "guard-top": 1, "guard-right": 1, stagger: 2, grab: 1,
    });
  });

  test("every frame is drawn at the battle size from either side, on every body type with every hair style", () => {
    for (const facing of BATTLE_FACINGS) {
      for (const body of LOOK_OPTIONS.body) {
        for (const hair of LOOK_OPTIONS.hair) {
          for (const [pose, count] of Object.entries(SWORD_POSES) as [SwordPose, number][]) {
            assert.equal(BODY_TYPES[body].battle[facing][pose].length, count, `${body} ${pose} ${facing}`);
            for (let frame = 0; frame < count; frame++) {
              const name = `${body} ${hair} ${pose} ${frame} ${facing}`;
              const pic = drawBattle({ ...DEFAULT_LOOK, body, hair }, pose, frame, facing);
              assert.equal(pic.width, VIEWS.battle.width, name);
              assert.equal(pic.height, VIEWS.battle.height, name);
              assert.ok(opaquePixels(pic) > 0, `${name}: nothing drawn`);
            }
          }
        }
      }
    }
  });

  test("the sword is drawn in the hand that holds it: the right on our right from behind, on our left in front", () => {
    const blade = new Set<string>([FIXED.steel[BASE], FIXED.steel[LIGHT]]);
    const steelSides = (pic: Picture) => {
      const sides = { left: 0, right: 0 };
      for (let i = 0; i < pic.width * pic.height; i++) {
        if (blade.has(hexAt(pic, i))) sides[i % pic.width < pic.width / 2 ? "left" : "right"]++;
      }
      return sides;
    };
    const near = { back: "right", front: "left" } as const, far = { back: "left", front: "right" } as const;
    for (const facing of BATTLE_FACINGS) {
      for (const pose of POSES) {
        const name = `${pose} ${facing}`;
        const right = steelSides(drawBattle(DEFAULT_LOOK, pose, 0, facing, STARTER_CLOTHES, "rightHand"));
        const left = steelSides(drawBattle(DEFAULT_LOOK, pose, 0, facing, STARTER_CLOTHES, "leftHand"));
        assert.ok(right[near[facing]] > right[far[facing]], `${name} right hand: ${JSON.stringify(right)}`);
        assert.ok(left[far[facing]] > left[near[facing]], `${name} left hand: ${JSON.stringify(left)}`);
        const none = steelSides(drawBattle(DEFAULT_LOOK, pose, 0, facing, STARTER_CLOTHES, null));
        assert.deepEqual(none, { left: 0, right: 0 }, name);
      }
    }
  });

  test("the face shows from the front, never from behind", () => {
    for (const eyeColor of LOOK_OPTIONS.eyeColor) {
      const iris = new Set<string>(EYES[eyeColor]);
      const irisPixels = (facing: (typeof BATTLE_FACINGS)[number]) => {
        const pic = drawBattle({ ...DEFAULT_LOOK, eyeColor }, "stand", 0, facing);
        return range(0, pic.width * pic.height - 1).filter((i) => iris.has(hexAt(pic, i))).length;
      };
      assert.equal(irisPixels("back"), 0, eyeColor);
      assert.ok(irisPixels("front") > 0, eyeColor);
    }
  });

  test("there's no frame past a pose's last", () => {
    assert.throws(() => drawBattle(DEFAULT_LOOK, "stagger", SWORD_POSES.stagger), RangeError);
    assert.throws(() => drawBattle(DEFAULT_LOOK, "stand", 1), RangeError);
  });

  test("every sword stays in the picture", () => {
    for (const facing of BATTLE_FACINGS) {
      for (const body of LOOK_OPTIONS.body) {
        for (const pose of Object.keys(SWORD_POSES) as SwordPose[]) {
          BODY_TYPES[body].battle[facing][pose].forEach(({ sword }, frame) => {
            for (const [x, y] of sword) {
              const inside = x >= 0 && x <= VIEWS.battle.width && y >= 0 && y <= VIEWS.battle.height;
              assert.ok(inside, `${body} ${pose} ${frame} ${facing}: the sword reaches ${x}, ${y}`);
            }
          });
        }
      }
    }
  });

  // The swings are named for the way the sword moves on screen (y grows down it): swing-tlbr goes from the top
  // left to the bottom right.
  test("each swing's sword tip moves frame by frame the way the swing is named", () => {
    const ways: Record<string, readonly [x: number, y: number]> = { l: [-1, 0], r: [1, 0], t: [0, -1], b: [0, 1] };
    const toward = (side: string, axis: 0 | 1) => [...side].reduce((sum, c) => sum + ways[c]![axis], 0);
    for (const body of LOOK_OPTIONS.body) {
      for (const pose of Object.keys(SWORD_POSES).filter((p) => p.startsWith("swing-")) as SwordPose[]) {
        const name = pose.slice("swing-".length), half = name.length / 2;
        const [from, to] = [name.slice(0, half), name.slice(half)];
        const tips = BODY_TYPES[body].battle.back[pose].map(({ sword: [, tip] }) => tip);
        for (const axis of [0, 1] as const) {
          const way = Math.sign(toward(to, axis) - toward(from, axis));
          if (!way) continue;
          tips.slice(1).forEach((tip, i) => {
            const step = tip[axis] - tips[i]![axis];
            assert.equal(Math.sign(step), way, `${body} ${pose} ${i + 1}: the tip moved ${step} along ${"xy"[axis]}`);
          });
        }
      }
    }
  });
});

/** The pixel's red, green, blue and alpha. */
const at = (pic: Picture, x: number, y: number) => [...pic.rgba.subarray((y * pic.width + x) * 4).subarray(0, 4)];
const brightness = (pic: Picture, x: number, y: number) => at(pic, x, y).slice(0, 3).reduce((a, b) => a + b);
const opaqueColumns = (pic: Picture, y: number) => range(0, pic.width - 1).filter((x) => at(pic, x, y)[3] === 255);

/** The chibi of each body type facing front and back, with the box its frame's legs fill and its middle column. */
const chibiLegs = () => LOOK_OPTIONS.body.flatMap((body) => (["front", "back"] as const).map((facing) => {
  const { legs, middle } = BODY_TYPES[body].chibi[facing];
  const cells = range(0, VIEWS.chibi.width * VIEWS.chibi.height - 1)
    .map((i) => [i % VIEWS.chibi.width, Math.floor(i / VIEWS.chibi.width)] as const)
    .filter(([x, y]) => legs(x, y));
  const [xs, ys] = [cells.map(([x]) => x), cells.map(([, y]) => y)];
  return {
    name: `${body} ${facing}`, pic: drawChibi({ ...DEFAULT_LOOK, body }, facing), middle,
    left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys),
  };
}));

// The legs used to stand apart under one boot as wide as both, and read as a bench.
describe("the chibi's legs, facing front and back", () => {
  test("they stand together, in boots as wide as they are, the soles a pixel wider each side", () => {
    for (const { name, pic, left, right, top, bottom } of chibiLegs()) {
      for (const y of range(top, bottom)) {
        assert.deepEqual(opaqueColumns(pic, y), range(left, right), `${name}, row ${y}`);
      }
      assert.deepEqual(opaqueColumns(pic, bottom + 1), range(left - 1, right + 1), `${name}, the soles`);
    }
  });

  test("the right one is in shadow, with a dark line where they meet", () => {
    for (const { name, pic, middle, top, bottom } of chibiLegs()) {
      for (const [part, y] of [["trousers", top], ["boots", bottom]] as const) {
        const [left, line, right] = [-1, 0, 1].map((dx) => brightness(pic, middle + dx, y));
        assert.ok(left! > right! && right! > line!, `${name}, ${part}: ${left} > ${right} > ${line}`);
      }
    }
  });
});
