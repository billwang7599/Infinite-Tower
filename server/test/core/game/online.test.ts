import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CLOSE_CODES, FIXED_DT } from "@infinite-tower/shared";
import { newPlayer } from "../../../src/core/content/player.js";
import { OnlinePlayers } from "../../../src/core/game/online.js";
import { FakeLink, MemoryPlayerStore } from "../../fixtures/fakes.js";
import { TEST_CHARACTER } from "../../fixtures/level.js";
import { ACCOUNT } from "./helpers.js";

function setup(opts: { withCharacter?: boolean; dev?: boolean } = {}) {
  const store = new MemoryPlayerStore();
  if (opts.withCharacter) store.saved.set(ACCOUNT.id, { ...newPlayer(), character: TEST_CHARACTER });
  return { store, online: new OnlinePlayers(store, opts.dev ?? false) };
}

async function joinNew(online: OnlinePlayers) {
  const link = new FakeLink();
  const session = await online.join(link, ACCOUNT);
  assert.ok(session, "join resolved null");
  return { link, session };
}

describe("joining", () => {
  test("a new player gets welcome with a new player's save, and no level until they make a character", async () => {
    const { online } = setup();
    const { link } = await joinNew(online);
    assert.deepEqual(link.sent.map((m) => m.t), ["welcome"]);
    const welcome = link.last("welcome");
    const fresh = newPlayer();
    assert.deepEqual(
      { vitals: welcome.vitals, wins: welcome.wins, settings: welcome.settings, character: welcome.character,
        bag: welcome.bag },
      fresh,
    );
    assert.equal(welcome.dev, false);
  });

  test("making a character saves it, then sends character and then the level", async () => {
    const { online, store } = setup();
    const { link, session } = await joinNew(online);
    session.setCharacter(TEST_CHARACTER);
    assert.deepEqual(link.sent.map((m) => m.t), ["welcome", "character", "level"]);
    assert.equal(store.saves.length, 1);
    assert.deepEqual(store.saved.get(ACCOUNT.id)?.character, TEST_CHARACTER);
  });

  test("a character is kept for good: a second one is ignored, not saved or sent", async () => {
    const { online, store } = setup({ withCharacter: true });
    const { link, session } = await joinNew(online);
    session.setCharacter({ ...TEST_CHARACTER, name: "Renamed" });
    assert.deepEqual(link.sent.map((m) => m.t), ["welcome", "level"]);
    assert.equal(store.saves.length, 0);
    assert.deepEqual(store.saved.get(ACCOUNT.id)?.character, TEST_CHARACTER);
  });

  test("a player with a saved character gets welcome and then the level", async () => {
    const { online } = setup({ withCharacter: true });
    const { link } = await joinNew(online);
    assert.deepEqual(link.sent.map((m) => m.t), ["welcome", "level"]);
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
    session.debugEncounter();
    for (let i = 0; i < 6; i++) online.tick(FIXED_DT);
    assert.equal(link.all("state").length, 0);
  });
});
