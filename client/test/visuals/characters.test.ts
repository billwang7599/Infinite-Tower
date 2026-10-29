import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";
import { DEFAULT_LOOK, LOOK_OPTIONS, type Look } from "@infinite-tower/shared";
import { BATTLE_FRAMES, PAINT_GAP_MS, PlayerLook } from "../../src/visuals/characters.js";
import type { BattleFacing } from "../../src/gfx/look/art.js";
import type { Pose, SwordPose } from "../../src/gfx/look/battle.js";
import { CHIBI_FACINGS } from "../../src/gfx/look/look.js";

const BATTLE_FRAME_COUNT = Object.values(BATTLE_FRAMES).reduce((sum, n) => sum + n, 0);

function setUp(t: TestContext) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const slice = () => t.mock.timers.tick(PAINT_GAP_MS);
  const painted: string[] = [];
  const frames = (facing: BattleFacing) => Object.fromEntries(Object.entries(BATTLE_FRAMES).map(([pose, n]) =>
    [pose, Array.from({ length: n }, (_, i) => `${facing} ${pose} ${i}`)])) as Record<Pose | SwordPose, string[]>;
  const battle = { back: frames("back"), front: frames("front") };
  const look = new PlayerLook({ chibi: { front: "chibi", back: "chibi", side: "chibi" }, battle }, (sprite) => {
    painted.push(sprite);
  });
  const count = () => ({
    chibi: painted.filter((s) => s === "chibi").length,
    battle: painted.filter((s) => s.startsWith("back ")).length,
    front: painted.filter((s) => s.startsWith("front ")).length,
  });
  return { look, slice, painted, count };
}

const otherLook: Look = { ...DEFAULT_LOOK, hair: LOOK_OPTIONS.hair.find((h) => h !== DEFAULT_LOOK.hair)! };

describe("PlayerLook", () => {
  test("wearing a look paints the chibi at once and no battle frame", (t) => {
    const { look, count } = setUp(t);
    look.wear(DEFAULT_LOOK);
    assert.deepEqual(count(), { chibi: CHIBI_FACINGS.length, battle: 0, front: 0 });
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
    const battleFrames = painted.filter((s) => s.startsWith("back "));
    assert.equal(battleFrames.length, BATTLE_FRAME_COUNT);
    assert.equal(new Set(battleFrames).size, BATTLE_FRAME_COUNT);
    assert.equal(count().chibi, CHIBI_FACINGS.length);
  });

  test("the same look again paints nothing", (t) => {
    const { look, slice, count } = setUp(t);
    look.wear(DEFAULT_LOOK);
    look.wear({ ...DEFAULT_LOOK });
    slice();
    assert.deepEqual(count(), { chibi: CHIBI_FACINGS.length, battle: 1, front: 0 });
  });

  test("a new look throws away the old look's unpainted frames", (t) => {
    const { look, slice, count } = setUp(t);
    look.wear(DEFAULT_LOOK);
    look.wear(otherLook);
    assert.equal(count().chibi, 2 * CHIBI_FACINGS.length);
    slice();
    assert.equal(count().battle, 1);
  });

  test("no frame from the front is painted ahead, not even on finishing", (t) => {
    const { look, count } = setUp(t);
    look.wear(DEFAULT_LOOK);
    look.finish();
    t.mock.timers.tick(PAINT_GAP_MS * 2 * BATTLE_FRAME_COUNT);
    assert.equal(count().front, 0);
  });

  test("a frame from the front is painted the first time it's asked for, once", (t) => {
    const { look, painted } = setUp(t);
    look.wear(DEFAULT_LOOK);
    look.finish();
    assert.equal(look.battleSprite("front", "swing-lr", 1), "front swing-lr 1");
    assert.equal(look.battleSprite("front", "swing-lr", 1), "front swing-lr 1");
    assert.equal(look.battleSprite("back", "stand", 0), "back stand 0");
    assert.deepEqual(painted.filter((s) => s.startsWith("front ")), ["front swing-lr 1"]);
  });

  test("a new look or weapon paints a frame from the front again when it's next asked for", (t) => {
    const { look, painted } = setUp(t);
    const fronts = () => painted.filter((s) => s.startsWith("front ")).length;
    look.wear(DEFAULT_LOOK);
    look.battleSprite("front", "stand", 0);
    look.wear(otherLook);
    assert.equal(fronts(), 1);
    look.battleSprite("front", "stand", 0);
    assert.equal(fronts(), 2);
    look.hold(null);
    look.battleSprite("front", "stand", 0);
    look.battleSprite("front", "stand", 0);
    assert.equal(fronts(), 3);
  });
});
