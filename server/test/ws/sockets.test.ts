import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  blankSkillbook, CLOSE_CODES, emptyBag, IDLE_INPUT, MAX_INPUTS_PER_MESSAGE, newCore, packFor, skillCost, staminaMaxOf,
  type Modifier, type Skill, type StepInput,
} from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { parseClientMsg } from "@infinite-tower/shared/net/client-messages";
import { PLAYER_STATS } from "../../src/core/content/player.js";
import { OnlinePlayers } from "../../src/core/game/online.js";
import { newStory } from "../../src/core/game/story.js";
import type { Account, PlayerSave } from "../../src/core/ports.js";
import { START_REGION } from "../../src/core/world/index.js";
import { connectionPingMs, gameSockets, type PingOptions } from "../../src/ws/sockets.js";
import { MemoryPlayerStore } from "../fixtures/fakes.js";
import { TEST_CHARACTER } from "../fixtures/world.js";
import { FakeSocket } from "./fake-socket.js";
import { armed } from "../fixtures/fight.js";

before(() => initPhysics());

const ACCOUNT: Account = { id: "account-1", username: "tester" };

const SAVED: PlayerSave = {
  vitals: { hp: 42, stamina: 30 }, settings: {}, character: TEST_CHARACTER,
  bag: { ...emptyBag(), items: [{ item: "boar-meat", count: 2, x: 0, y: 0, turned: false }] }, pack: packFor(null),
  quiver: packFor(null),
  knownWords: [],
  equipment: armed(), skillbook: blankSkillbook(), story: newStory(), pad: START_REGION, shopsBought: [],
  core: newCore(), faith: {},
};

/** Lets a pending store load (and what follows it) finish. */
const settle = () => new Promise(setImmediate);

function setup(ping: PingOptions = { dev: false, pingMs: 0 }, cheats = false) {
  const store = new MemoryPlayerStore();
  const sockets = gameSockets(new OnlinePlayers(store, cheats, 50), ping);
  const connect = async (account: Account | null = ACCOUNT, requestedPing?: string) => {
    const socket = new FakeSocket();
    sockets.accept(socket.ws, account, requestedPing);
    await settle();
    return socket;
  };
  return { store, sockets, connect };
}

describe("game sockets", () => {
  test("refuse a socket without a login, before loading anything", async (t) => {
    const { store, connect } = setup();
    const load = t.mock.method(store, "load");
    const socket = await connect(null);
    assert.equal(socket.closed?.code, CLOSE_CODES.notLoggedIn);
    assert.deepEqual(socket.sent, []);
    assert.equal(load.mock.callCount(), 0);
  });

  test("send welcome once a new player's save has loaded", async () => {
    const { connect } = setup();
    const socket = await connect();
    assert.deepEqual(socket.kinds(), ["welcome"]);
    const welcome = socket.messages[0];
    assert.equal(welcome?.t === "welcome" && welcome.character, null);
    assert.equal(socket.closed, null);
  });

  test("welcome a returning player with their save, then the world", async () => {
    const { store, connect } = setup();
    store.saved.set(ACCOUNT.id, structuredClone(SAVED));
    const socket = await connect();
    assert.deepEqual(socket.kinds(), ["welcome", "world", "chunks"]);
    const welcome = socket.messages[0];
    assert.ok(welcome?.t === "welcome");
    assert.deepEqual(welcome.vitals, SAVED.vitals);
    assert.deepEqual(welcome.character, TEST_CHARACTER);
    assert.deepEqual(welcome.gear.bag, SAVED.bag);
    assert.deepEqual(welcome.gear.equipment, SAVED.equipment);
  });

  test("a character message gets the character and the world back, and is saved", async () => {
    const { store, connect } = setup();
    const socket = await connect();
    socket.receive({ t: "character", character: TEST_CHARACTER });
    assert.deepEqual(socket.kinds(), ["welcome", "character", "world", "chunks"]);
    assert.deepEqual(store.saved.get(ACCOUNT.id)?.character, TEST_CHARACTER);
  });

  test("invalid messages are ignored", async () => {
    const { store, connect } = setup();
    const socket = await connect();
    socket.receive("{oops");
    socket.receive({ t: "character", character: { name: "", look: {} } });
    assert.deepEqual(socket.kinds(), ["welcome"]);
    assert.equal(socket.closed, null);
    assert.equal(store.saves.length, 0);
  });

  test("settings sent by the client are saved and come back in the next welcome, auto lock included", async () => {
    const { store, connect } = setup();
    store.saved.set(ACCOUNT.id, structuredClone(SAVED));
    const settings = { camera: { sensitivity: 2 }, mouse: { autoLock: false } };
    const first = await connect();
    first.receive({ t: "settings", settings });
    first.close(1001, "going away");
    assert.deepEqual(store.saved.get(ACCOUNT.id)?.settings, settings);
    const welcome = (await connect()).messages[0];
    assert.ok(welcome?.t === "welcome");
    assert.deepEqual(welcome.settings, settings);
  });

  test("closing the socket saves the player", async () => {
    const { store, connect } = setup();
    store.saved.set(ACCOUNT.id, structuredClone(SAVED));
    const socket = await connect();
    socket.close(1001, "going away");
    assert.equal(store.saves.length, 1);
    assert.deepEqual(store.saves[0], { id: ACCOUNT.id, data: SAVED });
  });

  test("a second socket for the same account replaces the first, which is saved once", async () => {
    const { store, connect } = setup();
    const first = await connect();
    first.receive({ t: "character", character: TEST_CHARACTER });
    const savesBefore = store.saves.length;
    const second = await connect();
    assert.equal(first.closed?.code, CLOSE_CODES.replaced);
    assert.equal(store.saves.length, savesBefore + 1);
    const welcome = second.messages[0];
    assert.ok(welcome?.t === "welcome");
    assert.deepEqual(welcome.character, TEST_CHARACTER);
    assert.equal(second.closed, null);
  });

  test("a taken-over tab's late messages are dropped: leaving a fight it was in doesn't throw", async () => {
    const { store, connect } = setup(undefined, true);
    store.saved.set(ACCOUNT.id, structuredClone(SAVED));
    const first = await connect();
    first.receive({ t: "cheat", cheat: { kind: "encounter", enemy: "wild-boar" } });
    assert.ok(first.kinds().includes("encounter"));
    await connect();
    assert.doesNotThrow(() => first.receive({ t: "leaveBattle" }));
  });

  test("a taken-over tab's late messages save nothing over the new tab's", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { store, connect } = setup();
    store.saved.set(ACCOUNT.id, structuredClone(SAVED));
    const first = await connect();
    await connect();
    const savesBefore = store.saves.length;
    first.receive({ t: "settings", settings: { camera: { sensitivity: 2 } } });
    t.mock.timers.tick(60_000);
    assert.equal(store.saves.length, savesBefore);
    assert.deepEqual(store.saved.get(ACCOUNT.id)?.settings, SAVED.settings);
  });

  test("a socket that closes while its save loads gets nothing and saves nothing", async () => {
    const { store, sockets } = setup();
    const release = store.hold();
    const socket = new FakeSocket();
    sockets.accept(socket.ws, ACCOUNT, undefined);
    socket.close(1001, "going away");
    release();
    await settle();
    assert.deepEqual(socket.sent, []);
    assert.equal(store.saves.length, 0);
  });

  test("messages that arrive before the save has loaded are dropped", async () => {
    const { store, sockets } = setup();
    const release = store.hold();
    const socket = new FakeSocket();
    sockets.accept(socket.ws, ACCOUNT, undefined);
    socket.receive({ t: "character", character: TEST_CHARACTER });
    release();
    await settle();
    assert.deepEqual(socket.kinds(), ["welcome"]);
  });

  test("a failed load closes the socket with 1011, and later messages are ignored", async (t) => {
    const { store, connect } = setup();
    t.mock.method(console, "error", () => {});
    store.failLoad = new Error("database down");
    const socket = await connect();
    assert.equal(socket.closed?.code, 1011);
    assert.deepEqual(socket.sent, []);
    socket.receive({ t: "character", character: TEST_CHARACTER });
    assert.deepEqual(socket.sent, []);
    assert.equal(store.saves.length, 0);
  });

  test("set a positive message size limit", () => {
    const { sockets } = setup();
    assert.ok(Number.isInteger(sockets.maxMessageBytes) && sockets.maxMessageBytes > 0);
  });

  test("take a frame of inputs holding the longest Beam a full stamina bar pays for, in one message", () => {
    const { sockets } = setup();
    const beam = (modifiers: Modifier[]): Skill => ({ segments: [{ form: "beam", elements: ["fire"], modifiers }] });
    const modifiers: Modifier[] = [];
    while (skillCost(beam([...modifiers, "amplify"])) <= staminaMaxOf(PLAYER_STATS)) modifiers.push("amplify");
    const inputs: StepInput[] = Array.from({ length: MAX_INPUTS_PER_MESSAGE }, (_, i) => ({
      ...IDLE_INPUT, step: i + 1, aimX: Math.sin(i / 10), aimZ: Math.cos(i / 10),
      cast: i === 0 ? beam(modifiers) : null, castHeld: i > 0,
    }));
    const raw = JSON.stringify({ t: "battleInput", upTo: MAX_INPUTS_PER_MESSAGE, inputs });
    assert.ok(raw.length < sockets.maxMessageBytes, `${raw.length} bytes`);
    const msg = parseClientMsg(raw);
    assert.ok(msg?.t === "battleInput" && msg.inputs.every((input, i) => input.castHeld === i > 0));
  });
});

describe("the simulated ping (dev only)", () => {
  const DEV = { dev: true, pingMs: 50 };

  test("is the env's for every connection, unless the page asks for another", () => {
    assert.equal(connectionPingMs(DEV, undefined), 50);
    for (const ms of [0, 37, 1000]) assert.equal(connectionPingMs(DEV, String(ms)), ms);
  });

  test("a ?ping= that isn't a whole number of ms, 0 or more, gets the env's", () => {
    for (const asked of ["", "-5", "1.5", "fast"]) assert.equal(connectionPingMs(DEV, asked), 50, asked);
  });

  test("is never on in production, whatever's asked", () => {
    assert.equal(connectionPingMs({ dev: false, pingMs: 0 }, "200"), 0);
    assert.equal(connectionPingMs({ dev: false, pingMs: 300 }, undefined), 0);
  });

  test("delays that connection's messages half the ping each way", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { store, connect } = setup({ dev: true, pingMs: 0 });
    store.saved.set(ACCOUNT.id, structuredClone(SAVED));
    const socket = await connect(ACCOUNT, "200");
    assert.deepEqual(socket.sent, []);
    t.mock.timers.tick(100);
    assert.deepEqual(socket.kinds(), ["welcome", "world", "chunks"]);
  });
});
