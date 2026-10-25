import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { itemDef, PLAYER, REST_RANGE } from "@infinite-tower/shared";
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

describe("useItem", () => {
  test("eating meat while hurt heals, uses one up, saves, and sends itemUsed", () => {
    const hp = PLAYER.maxHp - MEAT_HEAL_HP - 5;
    const { session, link, saves } = startSession({
      saved: { vitals: { hp, stamina: 20 }, inventory: { "boar-meat": 2 } },
    });
    session.useItem("boar-meat");
    assert.deepEqual(session.vitals, { hp: hp + MEAT_HEAL_HP, stamina: 20 });
    assert.deepEqual(session.inventory, { "boar-meat": 1 });
    assert.equal(saves.length, 1);
    assert.deepEqual(link.last("itemUsed"), {
      t: "itemUsed", item: "boar-meat", vitals: session.vitals, inventory: { "boar-meat": 1 },
    });
  });

  test("healing is capped at max HP", () => {
    const { session } = startSession({
      saved: { vitals: { hp: PLAYER.maxHp - 1, stamina: 20 }, inventory: { "boar-meat": 1 } },
    });
    session.useItem("boar-meat");
    assert.equal(session.vitals.hp, PLAYER.maxHp);
    assert.deepEqual(session.inventory, {});
  });

  test("does nothing at full HP", () => {
    const { session, link, saves } = startSession({ saved: { inventory: { "boar-meat": 1 } } });
    session.useItem("boar-meat");
    assert.deepEqual(session.inventory, { "boar-meat": 1 });
    assert.equal(saves.length, 0);
    assert.equal(link.all("itemUsed").length, 0);
  });

  test("does nothing without any meat", () => {
    const { session, link } = startSession({ saved: { vitals: { hp: 10, stamina: 20 } } });
    session.useItem("boar-meat");
    assert.equal(session.vitals.hp, 10);
    assert.equal(link.all("itemUsed").length, 0);
  });

  test("does nothing during a battle", () => {
    const { session, link } = startSession({
      dev: true, saved: { vitals: { hp: 10, stamina: 20 }, inventory: { "boar-meat": 1 } },
    });
    session.debugEncounter();
    session.useItem("boar-meat");
    assert.deepEqual(session.inventory, { "boar-meat": 1 });
    assert.equal(link.all("itemUsed").length, 0);
  });
});
