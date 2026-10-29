import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { JOIN_RANGE_TILES, PILE_RANGE_TILES, REST_RANGE_TILES, type LevelLayout } from "@infinite-tower/shared";
import { interactionAt } from "../../../src/modes/overworld/overworld.js";

const FIRE = { x: 0, z: 0 };
const level = { campfires: [FIRE] } as unknown as LevelLayout;
const at = (x: number) => ({ x, z: 0 });

describe("what the Interact key does where you stand", () => {
  test("by a campfire, rests", () => {
    assert.equal(interactionAt(level, at(REST_RANGE_TILES - 0.1), [], []), "rest");
  });

  test("by a player in a battle, joins it", () => {
    assert.equal(interactionAt(level, at(10), [at(10 + JOIN_RANGE_TILES - 0.1)], []), "joinFight");
  });

  test("by a pile, opens it", () => {
    assert.equal(interactionAt(level, at(10), [], [at(10 - PILE_RANGE_TILES + 0.1)]), "openPile");
  });

  test("by more than one, the nearest wins", () => {
    assert.equal(interactionAt(level, at(1), [at(1.5)], []), "joinFight");
    assert.equal(interactionAt(level, at(1), [at(2.2)], []), "rest");
    assert.equal(interactionAt(level, at(1), [at(2.2)], [at(1.2)]), "openPile");
    assert.equal(interactionAt(level, at(1), [at(1.1)], [at(1.2)]), "joinFight");
    assert.equal(interactionAt(level, at(0.5), [], [at(1.2)]), "rest");
  });

  test("out of reach of all of them, nothing", () => {
    const far = at(10);
    assert.equal(interactionAt(level, far, [at(10 + JOIN_RANGE_TILES + 0.1)], [at(10 - PILE_RANGE_TILES - 0.1)]), null);
  });
});
