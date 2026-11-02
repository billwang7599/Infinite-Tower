import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  INTERACT_LOOK_RAD, INTERACT_RANGE_M, JOIN_RANGE_TILES, REST_RANGE_TILES, type LevelLayout, type PlacedNpc,
  type Vec2,
} from "@infinite-tower/shared";
import { interactionAt } from "../../../src/modes/overworld/overworld.js";

const FIRE = { x: 0, z: 0 };
const level = { campfires: [FIRE], npcs: [], traces: [], pads: [] } as unknown as LevelLayout;
const at = (x: number, z = 0) => ({ x, z });
const npcAt = (spot: Vec2): PlacedNpc => ({ npc: "hollis", at: spot, heading: "west" });
const withNpcs = (...spots: Vec2[]) => ({ ...level, npcs: spots.map(npcAt) });
const withTraces = (...traces: Vec2[]) => ({ ...level, traces });
const withPads = (...pads: Vec2[]) => ({ ...level, pads });

describe("what the Interact key does where you stand", () => {
  test("by a campfire, rests, whichever way you face", () => {
    assert.equal(interactionAt(level, at(REST_RANGE_TILES - 0.1), "east", [], []), "rest");
  });

  test("by a player in a battle, joins it, whichever way you face", () => {
    assert.equal(interactionAt(level, at(10), "west", [at(10 + JOIN_RANGE_TILES - 0.1)], []), "joinFight");
  });

  test("by a pile you face, opens it", () => {
    assert.equal(interactionAt(level, at(10), "west", [], [at(10 - INTERACT_RANGE_M + 0.1)]), "openPile");
  });

  test("not a pile behind or beside you, nor one further round than INTERACT_LOOK_RAD", () => {
    const pile = at(10 - 1);
    assert.equal(interactionAt(level, at(10), "east", [], [pile]), null);
    assert.equal(interactionAt(level, at(10), "north", [], [pile]), null);
    const edge = (rad: number) => at(10 + Math.sin(rad), Math.cos(rad));
    assert.equal(interactionAt(level, at(10), "north", [], [edge(INTERACT_LOOK_RAD - 0.02)]), "openPile");
    assert.equal(interactionAt(level, at(10), "north", [], [edge(INTERACT_LOOK_RAD + 0.02)]), null);
  });

  test("by an NPC you face, talks; not one behind you or out of reach", () => {
    assert.equal(interactionAt(withNpcs(at(10 - INTERACT_RANGE_M + 0.1)), at(10), "west", [], []), "talk");
    assert.equal(interactionAt(withNpcs(at(10 - 1)), at(10), "east", [], []), null);
    assert.equal(interactionAt(withNpcs(at(10 - INTERACT_RANGE_M - 0.1)), at(10), "west", [], []), null);
  });

  test("by what an NPC left behind, faced as an NPC is, looks at it", () => {
    assert.equal(interactionAt(withTraces(at(10 - INTERACT_RANGE_M + 0.1)), at(10), "west", [], []), "look");
    assert.equal(interactionAt(withTraces(at(10 - 1)), at(10), "east", [], []), null);
    assert.equal(interactionAt(withTraces(at(10 - INTERACT_RANGE_M - 0.1)), at(10), "west", [], []), null);
  });

  test("by a summoning pad you face, or standing on it, binds you to it; not one behind you or out of reach", () => {
    assert.equal(interactionAt(withPads(at(10 - INTERACT_RANGE_M + 0.1)), at(10), "west", [], []), "bindPad");
    assert.equal(interactionAt(withPads(at(10)), at(10), "east", [], []), "bindPad");
    assert.equal(interactionAt(withPads(at(10 - 1)), at(10), "east", [], []), null);
    assert.equal(interactionAt(withPads(at(10 - INTERACT_RANGE_M - 0.1)), at(10), "west", [], []), null);
  });

  test("a pile and an NPC both in view: the one nearest the way you face", () => {
    const off = (rad: number) => at(10 + Math.sin(rad), Math.cos(rad));
    const npc = off(INTERACT_LOOK_RAD * 0.8), pile = off(-INTERACT_LOOK_RAD * 0.1);
    assert.equal(interactionAt(withNpcs(npc), at(10), "north", [], [pile]), "openPile");
    assert.equal(interactionAt(withNpcs(pile), at(10), "north", [], [npc]), "talk");
  });

  test("by more than one, the nearest wins", () => {
    assert.equal(interactionAt(level, at(1), "east", [at(1.5)], []), "joinFight");
    assert.equal(interactionAt(level, at(1), "east", [at(2.2)], []), "rest");
    assert.equal(interactionAt(level, at(1), "east", [at(2.2)], [at(1.2)]), "openPile");
    assert.equal(interactionAt(level, at(1), "east", [at(1.1)], [at(1.2)]), "joinFight");
    assert.equal(interactionAt(level, at(0.5), "east", [], [at(1.2)]), "rest");
    assert.equal(interactionAt(withNpcs(at(1.2)), at(0.5), "east", [], []), "rest");
    assert.equal(interactionAt(withNpcs(at(1.2)), at(1), "east", [], []), "talk");
  });

  test("out of reach of all of them, nothing", () => {
    const fights = [at(10 + JOIN_RANGE_TILES + 0.1)], piles = [at(10 - INTERACT_RANGE_M - 0.1)];
    assert.equal(interactionAt(level, at(10), "west", fights, piles), null);
  });
});
