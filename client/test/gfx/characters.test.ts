import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";
import { DEFAULT_LOOK, LOOK_OPTIONS, type Look } from "@infinite-tower/shared";
import { BATTLE_FRAMES, PAINT_GAP_MS, PlayerLook } from "../../src/gfx/characters.js";
import type { Pose, SwordPose } from "../../src/gfx/look/battle.js";
import { CHIBI_FACINGS } from "../../src/gfx/look/look.js";

const BATTLE_FRAME_COUNT = Object.values(BATTLE_FRAMES).reduce((sum, n) => sum + n, 0);

function setUp(t: TestContext) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const slice = () => t.mock.timers.tick(PAINT_GAP_MS);
  const painted: string[] = [];
  const battle = Object.fromEntries(
    Object.entries(BATTLE_FRAMES).map(([pose, n]) => [pose, Array.from({ length: n }, (_, i) => `${pose} ${i}`)]),
  ) as Record<Pose | SwordPose, string[]>;
  const look = new PlayerLook({ chibi: { front: "chibi", back: "chibi", side: "chibi" }, battle }, (sprite) => {
    painted.push(sprite);
  });
  const count = () => ({
    chibi: painted.filter((s) => s === "chibi").length,
    battle: painted.filter((s) => s !== "chibi").length,
  });
  return { look, slice, painted, count };
}

const otherLook: Look = { ...DEFAULT_LOOK, hair: LOOK_OPTIONS.hair.find((h) => h !== DEFAULT_LOOK.hair)! };

describe("PlayerLook", () => {
  test("wearing a look paints the chibi at once and no battle frame", (t) => {
    const { look, count } = setUp(t);
    look.wear(DEFAULT_LOOK);
    assert.deepEqual(count(), { chibi: CHIBI_FACINGS.length, battle: 0 });
  });

  test("battle frames are painted later, one per slice", (t) => {
    const { look, slice, count } = setUp(t);
    look.wear(DEFAULT_LOOK);
    slice();
    assert.equal(count().battle, 1);
    slice();
    assert.equal(count().battle, 2);
  });

  test("finishing paints every battle frame not painted yet, each once, and nothing after", (t) => {
    const { look, slice, painted, count } = setUp(t);
    look.wear(DEFAULT_LOOK);
    slice();
    look.finish();
    slice();
    const battleFrames = painted.filter((s) => s !== "chibi");
    assert.equal(battleFrames.length, BATTLE_FRAME_COUNT);
    assert.equal(new Set(battleFrames).size, BATTLE_FRAME_COUNT);
    assert.equal(count().chibi, CHIBI_FACINGS.length);
  });

  test("the same look again paints nothing", (t) => {
    const { look, slice, count } = setUp(t);
    look.wear(DEFAULT_LOOK);
    look.wear({ ...DEFAULT_LOOK });
    slice();
    assert.deepEqual(count(), { chibi: CHIBI_FACINGS.length, battle: 1 });
  });

  test("a new look throws away the old look's unpainted frames", (t) => {
    const { look, slice, count } = setUp(t);
    look.wear(DEFAULT_LOOK);
    look.wear(otherLook);
    assert.equal(count().chibi, 2 * CHIBI_FACINGS.length);
    slice();
    assert.equal(count().battle, 1);
  });
});
