import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { JOIN_RANGE_TILES, REST_RANGE, type LevelLayout } from "@infinite-tower/shared";
import { interactionAt } from "../../../src/modes/overworld/overworld.js";

const FIRE = { x: 0, z: 0 };
const level = { campfires: [FIRE] } as unknown as LevelLayout;
const at = (x: number) => ({ x, z: 0 });

describe("what the Rest key does where you stand", () => {
  test("by a campfire, rests", () => {
    assert.equal(interactionAt(level, at(REST_RANGE - 0.1), []), "rest");
  });

  test("by a player in a battle, joins it", () => {
    assert.equal(interactionAt(level, at(10), [at(10 + JOIN_RANGE_TILES - 0.1)]), "joinFight");
  });

  test("by both, joins only if no campfire is closer", () => {
    assert.equal(interactionAt(level, at(1), [at(1.5)]), "joinFight");
    assert.equal(interactionAt(level, at(1), [at(2.2)]), "rest");
  });

  test("out of reach of either, nothing", () => {
    assert.equal(interactionAt(level, at(10), [at(10 + JOIN_RANGE_TILES + 0.1)]), null);
  });
});
