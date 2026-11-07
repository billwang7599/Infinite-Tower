import assert from "node:assert/strict";
import { before, describe, test, type TestContext } from "node:test";
import { CLOSE_CODES, FIXED_DT, IDLE_INPUT, type ClientMsg } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { newPlayer } from "../../../src/core/content/player.js";
import { IDLE_KICK_MS, OnlinePlayers } from "../../../src/core/game/online.js";
import { FakeLink, MemoryPlayerStore } from "../../fixtures/fakes.js";
import { TEST_CHARACTER } from "../../fixtures/world.js";
import { ACCOUNT } from "./helpers.js";

before(() => initPhysics());

async function joined(t: TestContext) {
  t.mock.timers.enable({ apis: ["Date"], now: 0 });
  const store = new MemoryPlayerStore();
  store.saved.set(ACCOUNT.id, { ...newPlayer(), character: TEST_CHARACTER });
  const online = new OnlinePlayers(store, true, 50);
  const link = new FakeLink();
  const session = await online.join(link, ACCOUNT);
  assert.ok(session);
  const wait = (ms: number) => {
    t.mock.timers.tick(ms);
    online.tick(FIXED_DT);
  };
  return { online, store, link, session, wait };
}

describe("idle players", () => {
  test("a player who does nothing for IDLE_KICK_MS is closed as idle, and leaves saved", async (t) => {
    const { online, store, link, wait } = await joined(t);
    wait(IDLE_KICK_MS - 1);
    assert.equal(link.open, true);
    const saves = store.saves.length;
    wait(1);
    assert.equal(link.closed?.code, CLOSE_CODES.idle);
    assert.equal(online.count, 0);
    assert.equal(store.saves.length, saves + 1);
  });

  test("anything the player does starts the wait again", async (t) => {
    const { online, link, session, wait } = await joined(t);
    const done: ClientMsg[] = [
      { t: "input", seq: 1, moveX: 1, moveZ: 0 },
      { t: "chat", text: "hi" },
      { t: "battleInput", upTo: 5, inputs: [{ step: 5, ...IDLE_INPUT }] },
    ];
    for (const msg of done) {
      wait(IDLE_KICK_MS - 1);
      online.heard(session, msg);
    }
    wait(IDLE_KICK_MS - 1);
    assert.equal(link.closed, null);
  });

  test("what the client sends on its own (a fight's heartbeat, a resync) doesn't count", async (t) => {
    const { online, link, session, wait } = await joined(t);
    wait(IDLE_KICK_MS - 1);
    online.heard(session, { t: "battleInput", upTo: 90, inputs: [] });
    online.heard(session, { t: "battleResync" });
    online.heard(session, { t: "ping", id: 1 });
    wait(1);
    assert.equal(link.closed?.code, CLOSE_CODES.idle);
  });
});
