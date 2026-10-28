import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { FightEvent } from "@infinite-tower/shared/fight";
import { FiredEffects } from "../../src/visuals/visuals.js";

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
