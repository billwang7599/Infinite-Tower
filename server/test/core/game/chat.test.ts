import assert from "node:assert/strict";
import { before, describe, test, type TestContext } from "node:test";
import { MAX_CHAT_CHARS, type Character } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { newPlayer } from "../../../src/core/content/player.js";
import {
  Chat, CHAT_HISTORY_LINES, CHAT_LINES_ON_JOIN, CHAT_WINDOW_MS, MAX_CHAT_LINES_PER_WINDOW,
} from "../../../src/core/game/chat.js";
import { OnlinePlayers } from "../../../src/core/game/online.js";
import type { Account } from "../../../src/core/ports.js";
import { FakeLink, MemoryPlayerStore } from "../../fixtures/fakes.js";
import { TEST_CHARACTER } from "../../fixtures/level.js";
import { ACCOUNT, startSession } from "./helpers.js";

before(() => initPhysics());

const B: Account = { id: "player-2", username: "bee" };
const NEW: Account = { id: "player-3", username: "newcomer" };
const B_CHARACTER: Character = { ...TEST_CHARACTER, name: "Bee" };

async function players() {
  const store = new MemoryPlayerStore();
  store.saved.set(ACCOUNT.id, { ...newPlayer(), character: TEST_CHARACTER });
  store.saved.set(B.id, { ...newPlayer(), character: B_CHARACTER });
  const online = new OnlinePlayers(store, true, 50);
  const join = async (account: Account) => {
    const link = new FakeLink();
    const session = await online.join(link, account);
    assert.ok(session);
    return { link, session };
  };
  return { online, join, a: await join(ACCOUNT), b: await join(B) };
}

/** Date.now() under the test's control, starting at 0. */
function clock(t: TestContext) {
  t.mock.timers.enable({ apis: ["Date"], now: 0 });
  return (ms: number) => t.mock.timers.tick(ms);
}

const heard = (link: FakeLink) => link.all("chat").map((m) => m.line);

describe("chat", () => {
  test("a line goes to everyone online, stamped with the speaker's character name", async () => {
    const { a, b } = await players();
    a.session.chat("hello all");
    const line = { from: TEST_CHARACTER.name, text: "hello all" };
    assert.deepEqual(heard(a.link), [line]);
    assert.deepEqual(heard(b.link), [line]);
  });

  test("each hears who said it: you, or the speaker's id among state's players when on the same level", async () => {
    const { a, b } = await players();
    b.session.chat("over here");
    assert.equal(a.link.last("chat").speaker, b.session.me);
    assert.equal(b.link.last("chat").speaker, "you");
  });

  test("it reaches other levels and a player still making a character, with the speaker on neither's map", () => {
    const far = startSession({ saved: { character: { ...TEST_CHARACTER, name: "Far" } } });
    const other = startSession();
    const creating = startSession({ saved: { character: null } });
    assert.notEqual(far.session.overworld, other.session.overworld);
    const chat = new Chat(() => [far.session, other.session, creating.session]);
    chat.say(far.session, "anyone?");
    assert.deepEqual(other.link.last("chat"), { t: "chat", line: { from: "Far", text: "anyone?" }, speaker: null });
    assert.equal(creating.link.last("chat").speaker, null);
  });

  test("a player in a fight hears it too", async () => {
    const { a, b } = await players();
    b.session.cheat({ kind: "encounter", enemy: "wild-boar" });
    assert.ok(b.session.battle);
    a.session.chat("good luck");
    assert.equal(heard(b.link).at(-1)?.text, "good luck");
  });

  test("a player with no character yet can't speak", async () => {
    const { a, join } = await players();
    const creating = await join(NEW);
    creating.session.chat("hi");
    assert.deepEqual(heard(a.link), []);
    assert.deepEqual(creating.link.all("chatRefused"), []);
  });

  test("a player who joins gets the last CHAT_LINES_ON_JOIN lines in welcome, oldest first", async (t) => {
    const tick = clock(t);
    const { a, join } = await players();
    const said = Array.from({ length: CHAT_LINES_ON_JOIN + 7 }, (_, i) => `line ${i}`);
    for (const [i, text] of said.entries()) {
      if (i > 0 && i % MAX_CHAT_LINES_PER_WINDOW === 0) tick(CHAT_WINDOW_MS);
      a.session.chat(text);
    }
    const { link } = await join(NEW);
    const expected = said.slice(-CHAT_LINES_ON_JOIN).map((text) => ({ from: TEST_CHARACTER.name, text }));
    assert.deepEqual(link.last("welcome").chat, expected);
  });

  test("with nothing said yet, welcome's chat is empty", async () => {
    const { a } = await players();
    assert.deepEqual(a.link.last("welcome").chat, []);
  });

  test("the server keeps the last CHAT_HISTORY_LINES lines, dropping the oldest", (t) => {
    const tick = clock(t);
    const { session } = startSession();
    const chat = new Chat(() => [session]);
    const total = CHAT_HISTORY_LINES + 3;
    for (let i = 0; i < total; i++) {
      if (i > 0 && i % MAX_CHAT_LINES_PER_WINDOW === 0) tick(CHAT_WINDOW_MS);
      chat.say(session, `line ${i}`);
    }
    assert.equal(chat.history.length, CHAT_HISTORY_LINES);
    assert.equal(chat.history[0]?.text, "line 3");
    assert.equal(chat.history.at(-1)?.text, `line ${total - 1}`);
  });

  test("MAX_CHAT_LINES_PER_WINDOW lines in CHAT_WINDOW_MS; more are dropped and the sender is told", async (t) => {
    const tick = clock(t);
    const { a, b } = await players();
    for (let i = 0; i < MAX_CHAT_LINES_PER_WINDOW; i++) a.session.chat(`spam ${i}`);
    tick(CHAT_WINDOW_MS - 1);
    a.session.chat("one too many");
    assert.equal(heard(b.link).length, MAX_CHAT_LINES_PER_WINDOW);
    assert.equal(heard(a.link).length, MAX_CHAT_LINES_PER_WINDOW);
    assert.deepEqual(a.link.all("chatRefused"), [{ t: "chatRefused", reason: "tooFast" }]);
    assert.deepEqual(b.link.all("chatRefused"), []);
    tick(1);
    a.session.chat("calm again");
    assert.equal(heard(b.link).at(-1)?.text, "calm again");
  });

  test("the limit is each player's own", async (t) => {
    clock(t);
    const { a, b } = await players();
    for (let i = 0; i < MAX_CHAT_LINES_PER_WINDOW; i++) a.session.chat(`a ${i}`);
    b.session.chat("my turn");
    assert.equal(heard(a.link).at(-1)?.text, "my turn");
  });

  test("a line of up to MAX_CHAT_CHARS goes out; a longer one is dropped and the sender is told", async () => {
    const { a, b } = await players();
    a.session.chat("x".repeat(MAX_CHAT_CHARS));
    a.session.chat("x".repeat(MAX_CHAT_CHARS + 1));
    assert.deepEqual(heard(b.link).map((l) => l.text.length), [MAX_CHAT_CHARS]);
    assert.deepEqual(a.link.all("chatRefused"), [{ t: "chatRefused", reason: "tooLong" }]);
  });

  test("lines are kept in memory only: a new server starts with none", async () => {
    const first = await players();
    first.a.session.chat("before the restart");
    const second = await players();
    assert.deepEqual(second.a.link.last("welcome").chat, []);
  });
});
