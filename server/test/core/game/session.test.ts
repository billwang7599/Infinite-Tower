import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { emptyBag, itemDef, PLAYER, REST_RANGE, type Bag, type ItemId } from "@infinite-tower/shared";
import { fullVitals, PLAYER_STATS } from "../../../src/core/content/player.js";
import { getLevel, START_LEVEL } from "../../../src/core/levels/index.js";
import { startSession } from "./helpers.js";

const MEAT_HEAL_HP = itemDef("boar-meat").healHp ?? 0;
const FULL = fullVitals(PLAYER_STATS);
const campfire = () => {
  const fire = getLevel(START_LEVEL).layout.campfires[0];
  if (!fire) throw new Error("the start level has no campfire");
  return fire;
};

describe("input", () => {
  test("is queued while walking the field", () => {
    const { session } = startSession();
    session.input(1, 1, 0);
    assert.equal(session.field.playerData().queue.length, 1);
  });

  test("is ignored during a battle", () => {
    const { session } = startSession({ dev: true });
    session.debugEncounter();
    session.input(1, 1, 0);
    assert.equal(session.field.playerData().queue.length, 0);
  });
});

describe("settings", () => {
  test("a burst of changes is saved once, after the debounce, with the latest settings", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { session, saves } = startSession();
    session.setSettings({ camera: { sensitivity: 1.5 } });
    session.setSettings({ camera: { sensitivity: 2 } });
    t.mock.timers.tick(10);
    assert.equal(saves.length, 0);
    t.mock.timers.tick(5000);
    assert.equal(saves.length, 1);
    assert.deepEqual(saves[0]?.settings, { camera: { sensitivity: 2 } });
  });

  test("saving (leaving) writes pending settings at once, and the debounce doesn't save again", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { session, saves } = startSession();
    session.setSettings({ camera: { sensitivity: 0.5 } });
    session.save();
    assert.equal(saves.length, 1);
    assert.deepEqual(saves[0]?.settings, { camera: { sensitivity: 0.5 } });
    t.mock.timers.tick(5000);
    assert.equal(saves.length, 1);
  });
});

describe("debugEncounter", () => {
  test("starts a battle on a dev server", () => {
    const { session, link } = startSession({ dev: true });
    session.debugEncounter();
    assert.ok(session.battle);
    assert.equal(link.all("encounter").length, 1);
  });

  test("does nothing on a production server", () => {
    const { session, link } = startSession({ dev: false });
    session.debugEncounter();
    assert.equal(session.battle, null);
    assert.equal(link.all("encounter").length, 0);
  });

  test("does nothing before the player has a level", () => {
    const { session, link } = startSession({ dev: true, saved: { character: null } });
    session.debugEncounter();
    assert.equal(link.all("encounter").length, 0);
  });
});

describe("rest", () => {
  test("by a campfire refills HP and stamina, saves, and sends rested", () => {
    const { session, link, saves } = startSession({ saved: { vitals: { hp: 10, stamina: 3 } } });
    session.field.place(campfire());
    session.rest();
    assert.deepEqual(session.vitals, FULL);
    assert.equal(saves.length, 1);
    assert.deepEqual(saves[0]?.vitals, FULL);
    assert.deepEqual(link.last("rested").vitals, FULL);
  });

  test("works anywhere within reach of the fire", () => {
    const fire = campfire();
    const { session, link } = startSession({ saved: { vitals: { hp: 10, stamina: 3 } } });
    session.field.place({ x: fire.x + REST_RANGE * 0.9, z: fire.z });
    session.rest();
    assert.deepEqual(link.last("rested").vitals, FULL);
  });

  test("away from the fire does nothing", () => {
    const fire = campfire();
    const { session, link, saves } = startSession({ saved: { vitals: { hp: 10, stamina: 3 } } });
    session.field.place({ x: fire.x + REST_RANGE + 1, z: fire.z });
    session.rest();
    assert.deepEqual(session.vitals, { hp: 10, stamina: 3 });
    assert.equal(saves.length, 0);
    assert.equal(link.all("rested").length, 0);
  });

  test("at full vitals still sends rested but doesn't save", () => {
    const { session, link, saves } = startSession();
    session.field.place(campfire());
    session.rest();
    assert.deepEqual(link.last("rested").vitals, FULL);
    assert.equal(saves.length, 0);
  });

  test("does nothing during a battle", () => {
    const { session, link } = startSession({ dev: true, saved: { vitals: { hp: 10, stamina: 3 } } });
    session.field.place(campfire());
    session.debugEncounter();
    session.rest();
    assert.equal(link.all("rested").length, 0);
    assert.deepEqual(session.vitals, { hp: 10, stamina: 3 });
  });
});

/** A bag holding `items`, each `[item, count, x, y]`, lying flat. */
const bagOf = (...items: [ItemId, number, number, number][]): Bag =>
  ({ ...emptyBag(), items: items.map(([item, count, x, y]) => ({ item, count, x, y, turned: false })) });

describe("useItem", () => {
  const MEAT_CELL = { x: 2, y: 1 };

  test("eating meat while hurt heals, uses one up, saves, and sends itemUsed", () => {
    const hp = PLAYER.maxHp - MEAT_HEAL_HP - 5;
    const { session, link, saves } = startSession({
      saved: { vitals: { hp, stamina: 20 }, bag: bagOf(["boar-meat", 2, 2, 1]) },
    });
    session.useItem(MEAT_CELL);
    assert.deepEqual(session.vitals, { hp: hp + MEAT_HEAL_HP, stamina: 20 });
    assert.deepEqual(session.bag, bagOf(["boar-meat", 1, 2, 1]));
    assert.equal(saves.length, 1);
    assert.deepEqual(link.last("itemUsed"), {
      t: "itemUsed", item: "boar-meat", vitals: session.vitals, bag: session.bag,
    });
  });

  test("healing is capped at max HP, and the last one leaves the cell empty", () => {
    const { session } = startSession({
      saved: { vitals: { hp: PLAYER.maxHp - 1, stamina: 20 }, bag: bagOf(["boar-meat", 1, 2, 1]) },
    });
    session.useItem(MEAT_CELL);
    assert.equal(session.vitals.hp, PLAYER.maxHp);
    assert.deepEqual(session.bag, emptyBag());
  });

  test("does nothing at full HP", () => {
    const { session, link, saves } = startSession({ saved: { bag: bagOf(["boar-meat", 1, 2, 1]) } });
    session.useItem(MEAT_CELL);
    assert.deepEqual(session.bag, bagOf(["boar-meat", 1, 2, 1]));
    assert.equal(saves.length, 0);
    assert.equal(link.all("itemUsed").length, 0);
  });

  test("does nothing on an empty cell, or an item that can't be used", () => {
    const { session, link } = startSession({
      saved: { vitals: { hp: 10, stamina: 20 }, bag: bagOf(["boar-tusk", 1, 0, 0]) },
    });
    session.useItem(MEAT_CELL);
    session.useItem({ x: 0, y: 1 });
    assert.equal(session.vitals.hp, 10);
    assert.deepEqual(session.bag, bagOf(["boar-tusk", 1, 0, 0]));
    assert.equal(link.all("itemUsed").length, 0);
  });

  test("does nothing during a battle", () => {
    const { session, link } = startSession({
      dev: true, saved: { vitals: { hp: 10, stamina: 20 }, bag: bagOf(["boar-meat", 1, 2, 1]) },
    });
    session.debugEncounter();
    session.useItem(MEAT_CELL);
    assert.deepEqual(session.bag, bagOf(["boar-meat", 1, 2, 1]));
    assert.equal(link.all("itemUsed").length, 0);
  });
});

describe("moveItem", () => {
  test("moves an item, sends the bag back, and saves it soon after", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { session, link, saves } = startSession({ saved: { bag: bagOf(["boar-hide", 1, 0, 0]) } });
    session.moveItem({ x: 1, y: 1 }, { x: 3, y: 2 }, false);
    assert.deepEqual(session.bag, bagOf(["boar-hide", 1, 3, 2]));
    assert.deepEqual(link.last("bag"), { t: "bag", bag: session.bag });
    assert.equal(saves.length, 0);
    t.mock.timers.tick(5000);
    assert.equal(saves.length, 1);
    assert.deepEqual(saves[0]?.bag, session.bag);
  });

  test("a move that doesn't fit changes nothing, and sends the bag back as it is", () => {
    const start = bagOf(["boar-hide", 1, 0, 0], ["boar-tusk", 1, 2, 0]);
    const { session, link } = startSession({ saved: { bag: start } });
    session.moveItem({ x: 0, y: 0 }, { x: 1, y: 0 }, false);
    assert.deepEqual(session.bag, start);
    assert.deepEqual(link.last("bag"), { t: "bag", bag: start });
  });

  test("does nothing during a battle", () => {
    const start = bagOf(["boar-hide", 1, 0, 0]);
    const { session, link } = startSession({ dev: true, saved: { bag: start } });
    session.debugEncounter();
    session.moveItem({ x: 0, y: 0 }, { x: 3, y: 2 }, false);
    assert.deepEqual(session.bag, start);
    assert.equal(link.all("bag").length, 0);
  });
});
