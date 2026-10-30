import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  JOIN_RANGE_TILES, PILE_LOOK_RAD, PILE_RANGE_M, REST_RANGE_TILES, type LevelLayout,
} from "@infinite-tower/shared";
import { interactionAt } from "../../../src/modes/overworld/overworld.js";

const FIRE = { x: 0, z: 0 };
const level = { campfires: [FIRE] } as unknown as LevelLayout;
const at = (x: number, z = 0) => ({ x, z });

describe("what the Interact key does where you stand", () => {
  test("by a campfire, rests, whichever way you face", () => {
    assert.equal(interactionAt(level, at(REST_RANGE_TILES - 0.1), "east", [], []), "rest");
  });

  test("by a player in a battle, joins it, whichever way you face", () => {
    assert.equal(interactionAt(level, at(10), "west", [at(10 + JOIN_RANGE_TILES - 0.1)], []), "joinFight");
  });

  test("by a pile you face, opens it", () => {
    assert.equal(interactionAt(level, at(10), "west", [], [at(10 - PILE_RANGE_M + 0.1)]), "openPile");
  });

  test("not a pile behind or beside you, nor one further round than PILE_LOOK_RAD", () => {
    const pile = at(10 - 1);
    assert.equal(interactionAt(level, at(10), "east", [], [pile]), null);
    assert.equal(interactionAt(level, at(10), "north", [], [pile]), null);
    const edge = (rad: number) => at(10 + Math.sin(rad), Math.cos(rad));
    assert.equal(interactionAt(level, at(10), "north", [], [edge(PILE_LOOK_RAD - 0.02)]), "openPile");
    assert.equal(interactionAt(level, at(10), "north", [], [edge(PILE_LOOK_RAD + 0.02)]), null);
  });

  test("by more than one, the nearest wins", () => {
    assert.equal(interactionAt(level, at(1), "east", [at(1.5)], []), "joinFight");
    assert.equal(interactionAt(level, at(1), "east", [at(2.2)], []), "rest");
    assert.equal(interactionAt(level, at(1), "east", [at(2.2)], [at(1.2)]), "openPile");
    assert.equal(interactionAt(level, at(1), "east", [at(1.1)], [at(1.2)]), "joinFight");
    assert.equal(interactionAt(level, at(0.5), "east", [], [at(1.2)]), "rest");
  });

  test("out of reach of all of them, nothing", () => {
    const fights = [at(10 + JOIN_RANGE_TILES + 0.1)], piles = [at(10 - PILE_RANGE_M - 0.1)];
    assert.equal(interactionAt(level, at(10), "west", fights, piles), null);
  });
});
