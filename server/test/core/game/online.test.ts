import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  bagCounts, MODIFIERS, CLOSE_CODES, ELEMENTS, emptyEquipment, FIXED_DT, FORMS,
} from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { fullVitals, newPlayer, PLAYER_STATS } from "../../../src/core/content/player.js";
import { START_REGION } from "../../../src/core/world/index.js";
import { OnlinePlayers } from "../../../src/core/game/online.js";
import { newStory } from "../../../src/core/game/story.js";
import type { PlayerSave } from "../../../src/core/ports.js";
import { FakeLink, MemoryPlayerStore } from "../../fixtures/fakes.js";
import { TEST_CHARACTER } from "../../fixtures/world.js";
import { ACCOUNT } from "./helpers.js";

before(() => initPhysics());

function setup(opts: { withCharacter?: boolean; dev?: boolean; maxPlayers?: number } = {}) {
  const store = new MemoryPlayerStore();
  if (opts.withCharacter) store.saved.set(ACCOUNT.id, { ...newPlayer(), character: TEST_CHARACTER });
  return { store, online: new OnlinePlayers(store, opts.dev ?? false, opts.maxPlayers ?? 50) };
}

async function joinNew(online: OnlinePlayers) {
  const link = new FakeLink();
  const session = await online.join(link, ACCOUNT);
  assert.ok(session, "join resolved null");
  return { link, session };
}

describe("joining", () => {
  test("a new player gets welcome with a new save, carrying nothing, and no level before a character", async () => {
    const { online } = setup();
    const { link } = await joinNew(online);
    assert.deepEqual(link.sent.map((m) => m.t), ["welcome"]);
    const welcome = link.last("welcome");
    assert.deepEqual(
      { vitals: welcome.vitals, wins: welcome.wins, settings: welcome.settings, character: welcome.character,
        bag: welcome.gear.bag, equipment: welcome.gear.equipment, knownWords: welcome.knownWords,
        skillbook: welcome.skillbook, story: newStory(), pad: START_REGION, core: welcome.core, shopsBought: [],
        faith: welcome.faith },
      newPlayer(),
    );
    assert.deepEqual(welcome.questbook, []);
    assert.equal(welcome.dev, false);
  });

  test("making a character saves it, then sends character and then the world", async () => {
    const { online, store } = setup();
    const { link, session } = await joinNew(online);
    session.setCharacter(TEST_CHARACTER);
    assert.deepEqual(link.sent.map((m) => m.t), ["welcome", "character", "world", "chunks"]);
    assert.equal(store.saves.length, 1);
    assert.deepEqual(store.saved.get(ACCOUNT.id)?.character, TEST_CHARACTER);
  });

  test("a character is kept for good: a second one is ignored, not saved or sent", async () => {
    const { online, store } = setup({ withCharacter: true });
    const { link, session } = await joinNew(online);
    session.setCharacter({ ...TEST_CHARACTER, name: "Renamed" });
    assert.deepEqual(link.sent.map((m) => m.t), ["welcome", "world", "chunks"]);
    assert.equal(store.saves.length, 0);
    assert.deepEqual(store.saved.get(ACCOUNT.id)?.character, TEST_CHARACTER);
  });

  test("a player with a saved character gets welcome and then the world", async () => {
    const { online } = setup({ withCharacter: true });
    const { link } = await joinNew(online);
    assert.deepEqual(link.sent.map((m) => m.t), ["welcome", "world", "chunks"]);
    assert.deepEqual(link.last("welcome").character, TEST_CHARACTER);
  });

  test("joining again closes the old link as replaced, saves it first, and the new one loads that save", async () => {
    const { online, store } = setup({ withCharacter: true });
    const first = await joinNew(online);
    first.session.vitals = { hp: 40, stamina: 12 };
    const second = await joinNew(online);
    assert.equal(first.link.closed?.code, CLOSE_CODES.replaced);
    assert.equal(store.saves.length, 1);
    assert.deepEqual(store.saves[0]?.data.vitals, { hp: 40, stamina: 12 });
    assert.deepEqual(second.session.vitals, { hp: 40, stamina: 12 });
    assert.deepEqual(second.link.last("welcome").vitals, { hp: 40, stamina: 12 });
    assert.equal(second.link.open, true);
  });

  test("a save loads as it was: nothing is given back", async () => {
    const { online, store } = setup();
    const meat = { item: "boar-meat", count: 2, x: 1, y: 0, turned: false } as const;
    const bag = { ...newPlayer().bag, items: [meat] };
    store.saved.set(ACCOUNT.id, { ...newPlayer(), character: TEST_CHARACTER, knownWords: ["nova"], bag });
    const { link } = await joinNew(online);
    const welcome = link.last("welcome");
    assert.deepEqual(welcome.knownWords, ["nova"]);
    assert.deepEqual(welcome.gear.equipment, emptyEquipment());
    assert.deepEqual(welcome.gear.bag, bag);
  });

  test("the skill words a player knows come back from the store and are saved again", async () => {
    const { online, store } = setup();
    const knownWords = [...FORMS, ...ELEMENTS, ...MODIFIERS];
    store.saved.set(ACCOUNT.id, { ...newPlayer(), character: TEST_CHARACTER, knownWords });
    const { session } = await joinNew(online);
    session.save();
    assert.deepEqual(store.saves.at(-1)?.data.knownWords, knownWords);
  });

  test("a failed load closes the link with 1011 and resolves null", async (t) => {
    const { online, store } = setup();
    const logged = t.mock.method(console, "error", () => {});
    store.failLoad = new Error("database down");
    const link = new FakeLink();
    assert.equal(await online.join(link, ACCOUNT), null);
    assert.equal(link.closed?.code, 1011);
    assert.deepEqual(link.sent, []);
    assert.equal(logged.mock.callCount(), 1);
  });

  test("a link that closes while its save is loading resolves null and gets no welcome", async () => {
    const { online, store } = setup();
    const release = store.hold();
    const link = new FakeLink();
    const joining = online.join(link, ACCOUNT);
    link.close(1001, "tab closed");
    release();
    assert.equal(await joining, null);
    assert.deepEqual(link.sent, []);
  });
});

describe("a full server", () => {
  const OTHER: typeof ACCOUNT = { id: "player-2", username: "other" };

  test("counts the players online", async () => {
    const { online } = setup();
    assert.equal(online.count, 0);
    const { session } = await joinNew(online);
    assert.equal(online.count, 1);
    online.leave(session);
    assert.equal(online.count, 0);
  });

  test("refuses another player with the full close code, and starts no session", async () => {
    const { online } = setup({ maxPlayers: 1 });
    await joinNew(online);
    const link = new FakeLink();
    assert.equal(await online.join(link, OTHER), null);
    assert.equal(link.closed?.code, CLOSE_CODES.full);
    assert.deepEqual(link.sent, []);
    assert.equal(online.count, 1);
  });

  test("still lets a player already on it take over from another tab", async () => {
    const { online } = setup({ maxPlayers: 1 });
    const first = await joinNew(online);
    const second = await joinNew(online);
    assert.equal(first.link.closed?.code, CLOSE_CODES.replaced);
    assert.equal(second.link.closed, null);
    assert.equal(online.count, 1);
  });

  test("checks again once the save has loaded, as another player may have filled the last place", async (t) => {
    const { online, store } = setup({ maxPlayers: 1 });
    let release = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const load = store.load.bind(store);
    t.mock.method(store, "load", async (id: string) => {
      if (id === OTHER.id) await gate;
      return load(id);
    });
    const slow = new FakeLink();
    const joining = online.join(slow, OTHER);
    await joinNew(online);
    release();
    assert.equal(await joining, null);
    assert.equal(slow.closed?.code, CLOSE_CODES.full);
    assert.equal(online.count, 1);
  });
});

describe("leaving", () => {
  test("saves once, even when called twice", async () => {
    const { online, store } = setup({ withCharacter: true });
    const { session } = await joinNew(online);
    online.leave(session);
    online.leave(session);
    assert.equal(store.saves.length, 1);
  });

  test("a replaced session's own leave doesn't save again", async () => {
    const { online, store } = setup({ withCharacter: true });
    const first = await joinNew(online);
    await joinNew(online);
    online.leave(first.session);
    assert.equal(store.saves.length, 1);
  });

  test("mid-fight, it loses the fight: the bag and hands are emptied, and saved like that", async () => {
    const { online, store } = setup({ withCharacter: true, dev: true });
    const meat = { item: "boar-meat", count: 3, x: 0, y: 0, turned: false } as const;
    const bag: PlayerSave["bag"] = { ...newPlayer().bag, items: [meat] };
    store.saved.set(ACCOUNT.id, { ...newPlayer(), character: TEST_CHARACTER, bag });
    const { session } = await joinNew(online);
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    for (let i = 0; i < 30; i++) online.tick(FIXED_DT);
    online.leave(session);
    assert.equal(bagCounts(store.saved.get(ACCOUNT.id)!.bag)["boar-meat"], undefined);
    assert.deepEqual(store.saved.get(ACCOUNT.id)!.equipment, emptyEquipment());
  });

  test("a second tab taking over mid-fight is leaving it: the fight is lost", async () => {
    const { online, store } = setup({ withCharacter: true, dev: true });
    const first = await joinNew(online);
    first.session.cheat({ kind: "encounter", enemy: "wild-boar" });
    online.tick(FIXED_DT);
    const second = await joinNew(online);
    assert.equal(first.link.closed?.code, CLOSE_CODES.replaced);
    assert.equal(first.session.battle?.over, true);
    assert.deepEqual(store.saves.at(-1)?.data.vitals, fullVitals(PLAYER_STATS), "woke up rested, as after a death");
    assert.deepEqual(second.session.vitals, fullVitals(PLAYER_STATS));
  });

  test("a player who left isn't ticked any more", async () => {
    const { online } = setup({ withCharacter: true });
    const { link, session } = await joinNew(online);
    online.leave(session);
    for (let i = 0; i < 6; i++) online.tick(FIXED_DT);
    assert.equal(link.all("state").length, 0);
  });
});

describe("ticking", () => {
  test("sends state every third tick", async () => {
    const { online } = setup({ withCharacter: true });
    const { link } = await joinNew(online);
    online.tick(FIXED_DT);
    online.tick(FIXED_DT);
    assert.equal(link.all("state").length, 0);
    online.tick(FIXED_DT);
    assert.equal(link.all("state").length, 1);
    for (let i = 0; i < 3; i++) online.tick(FIXED_DT);
    assert.equal(link.all("state").length, 2);
  });

  test("sends no state before the player is in a level", async () => {
    const { online } = setup();
    const { link } = await joinNew(online);
    for (let i = 0; i < 6; i++) online.tick(FIXED_DT);
    assert.equal(link.all("state").length, 0);
  });

  test("sends no state during a battle", async () => {
    const { online } = setup({ withCharacter: true, dev: true });
    const { link, session } = await joinNew(online);
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    for (let i = 0; i < 6; i++) online.tick(FIXED_DT);
    assert.equal(link.all("state").length, 0);
  });
});
