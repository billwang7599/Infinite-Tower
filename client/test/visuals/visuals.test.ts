import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { FightEvent } from "@infinite-tower/shared/fight";
import { FiredEffects, overworldLookFrom } from "../../src/visuals/visuals.js";

const slam = (enemy: number): FightEvent => ({ type: "slam", enemy });

describe("one-shot effects", () => {
  test("a step replayed after a resync doesn't fire its events again", () => {
    const fired = new FiredEffects();
    const frame = [{ step: 4, event: slam(1) }, { step: 5, event: slam(1) }];
    assert.deepEqual(fired.take(frame), frame);
    const replayed = [{ step: 5, event: slam(1) }, { step: 6, event: slam(1) }];
    assert.deepEqual(fired.take(replayed), [{ step: 6, event: slam(1) }]);
  });

  test("a replay that turned out differently fires what's new", () => {
    const fired = new FiredEffects();
    fired.take([{ step: 5, event: slam(1) }]);
    assert.deepEqual(fired.take([{ step: 5, event: slam(2) }]), [{ step: 5, event: slam(2) }]);
  });
});

describe("which overworld is drawn", () => {
  test("the 2D one, unless the page asks for ?world=3d", () => {
    assert.equal(overworldLookFrom(""), "2d");
    assert.equal(overworldLookFrom("?debug&world=2d"), "2d");
    assert.equal(overworldLookFrom("?world=3d"), "3d");
    assert.equal(overworldLookFrom("?debug&world=3d&ping=80"), "3d");
  });
});
