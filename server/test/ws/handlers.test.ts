import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { dispatch } from "@infinite-tower/shared";
import type { GameSession } from "../../src/core/game/session.js";
import type { SessionMsg } from "../../src/ws/connection.js";
import { handlers } from "../../src/ws/handlers.js";
import { TEST_CHARACTER } from "../fixtures/level.js";

type Call = [method: string, ...args: unknown[]];

/** Stands in for a GameSession: records each method called on it, with its arguments. */
function fakeSession() {
  const calls: Call[] = [];
  const record = (method: string) => (...args: unknown[]) => { calls.push([method, ...args]); };
  const session = {
    input: record("input"),
    battleInput: record("battleInput"),
    battleResync: record("battleResync"),
    leaveBattle: record("leaveBattle"),
    setSettings: record("setSettings"),
    setCharacter: record("setCharacter"),
    rest: record("rest"),
    useItem: record("useItem"),
    moveItem: record("moveItem"),
    closeBag: record("closeBag"),
    openPile: record("openPile"),
    talk: record("talk"),
    acceptQuest: record("acceptQuest"),
    deliver: record("deliver"),
    cheat: record("cheat"),
    challenge: record("challenge"),
    answerChallenge: record("answerChallenge"),
    chat: record("chat"),
    statPoint: record("statPoint"),
    openShop: record("openShop"),
    buy: record("buy"),
    sell: record("sell"),
    exchange: record("exchange"),
  };
  return { calls, session: session as unknown as GameSession };
}

function handle(msg: SessionMsg): Call[] {
  const { calls, session } = fakeSession();
  dispatch(handlers, msg, session);
  return calls;
}

describe("message handlers", () => {
  test("input walks with its seq and direction", () => {
    assert.deepEqual(handle({ t: "input", seq: 7, moveX: -1, moveZ: 0.5 }), [["input", 7, -1, 0.5]]);
  });

  test("battleInput hands on how far the client has got and its changes, each with its step", () => {
    const inputs = [{ step: 4, moveX: 0, moveZ: 1, aimX: 0, aimZ: 1, jump: false, attack: "light" as const,
      dodge: false, way: null, block: false, cast: null, castHeld: false,
      chant: false, chantWords: null, write: null, locked: null, bag: false, gear: null, use: null }];
    assert.deepEqual(handle({ t: "battleInput", upTo: 6, inputs }), [["battleInput", 6, inputs]]);
  });

  test("battleResync asks for the whole fight", () => {
    assert.deepEqual(handle({ t: "battleResync" }), [["battleResync"]]);
  });

  test("leaveBattle leaves the arena", () => {
    assert.deepEqual(handle({ t: "leaveBattle" }), [["leaveBattle"]]);
  });

  test("settings are passed on whole", () => {
    const settings = {
      bindings: { overworld: { up: ["KeyW"] } }, camera: { sensitivity: 1.5 }, mouse: { autoLock: false },
    };
    assert.deepEqual(handle({ t: "settings", settings }), [["setSettings", settings]]);
  });

  test("character sets the character", () => {
    assert.deepEqual(handle({ t: "character", character: TEST_CHARACTER }), [["setCharacter", TEST_CHARACTER]]);
  });

  test("rest rests", () => {
    assert.deepEqual(handle({ t: "rest" }), [["rest"]]);
  });

  test("useItem uses the item in that cell", () => {
    const at = { in: "bag", x: 1, y: 2 } as const;
    assert.deepEqual(handle({ t: "useItem", at }), [["useItem", at]]);
  });

  test("moveItem moves from one spot to another, turned or not", () => {
    const from = { in: "bag", x: 0, y: 0 } as const, to = { in: "slot", slot: "leftHand" } as const;
    assert.deepEqual(handle({ t: "moveItem", from, to, turned: true }), [["moveItem", from, to, true]]);
  });

  test("closeBag closes it", () => {
    assert.deepEqual(handle({ t: "closeBag" }), [["closeBag"]]);
  });

  test("openPile opens one", () => {
    assert.deepEqual(handle({ t: "openPile" }), [["openPile"]]);
  });

  test("talk asks the NPC in view to speak", () => {
    assert.deepEqual(handle({ t: "talk" }), [["talk"]]);
  });

  test("acceptQuest and deliver name the quest", () => {
    assert.deepEqual(handle({ t: "acceptQuest", quest: "a-quest" }), [["acceptQuest", "a-quest"]]);
    assert.deepEqual(handle({ t: "deliver", quest: "a-quest" }), [["deliver", "a-quest"]]);
  });

  test("cheat passes the cheat on (the session ignores it unless on a dev server)", () => {
    const cheat = { kind: "give", item: "boar-meat", count: 2 } as const;
    assert.deepEqual(handle({ t: "cheat", cheat }), [["cheat", cheat]]);
  });

  test("challenge and answerChallenge reach the session", () => {
    assert.deepEqual(handle({ t: "challenge" }), [["challenge"]]);
    assert.deepEqual(handle({ t: "answerChallenge", accept: true }), [["answerChallenge", true]]);
  });

  test("chat passes on only the text: the session stamps the name", () => {
    assert.deepEqual(handle({ t: "chat", text: "hello" }), [["chat", "hello"]]);
  });

  test("statPoint passes on the stat and whether it's placed or taken back", () => {
    assert.deepEqual(handle({ t: "statPoint", stat: "vitality", add: false }), [["statPoint", "vitality", false]]);
  });

  test("openShop, buy, sell and exchange reach the session with what's traded", () => {
    assert.deepEqual(handle({ t: "openShop" }), [["openShop"]]);
    assert.deepEqual(handle({ t: "buy", item: "bread" }), [["buy", "bread"]]);
    assert.deepEqual(handle({ t: "sell", at: { in: "bag", x: 1, y: 2 }, count: 3 }), [["sell", { in: "bag", x: 1, y: 2 }, 3]]);
    assert.deepEqual(handle({ t: "exchange", from: "silver-coin", to: "copper-coin" }), [
      ["exchange", "silver-coin", "copper-coin"],
    ]);
  });

  test("every session message type has a handler", () => {
    const types: SessionMsg["t"][] = [
      "input", "battleInput", "battleResync", "leaveBattle", "settings", "character", "rest", "useItem", "moveItem",
      "closeBag", "openPile", "talk", "train", "acceptQuest", "deliver", "saveSkill", "cheat", "challenge",
      "answerChallenge", "joinBattle", "chat", "statPoint", "openShop", "buy", "sell", "exchange",
    ];
    assert.deepEqual(Object.keys(handlers).sort(), [...types].sort());
  });
});
