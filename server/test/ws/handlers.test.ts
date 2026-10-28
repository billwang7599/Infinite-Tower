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
    debugEncounter: record("debugEncounter"),
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
    const inputs = [{ step: 4, moveX: 0, moveZ: 1, aimX: 0, aimZ: 1, jump: false, attack: "lr" as const, dodge: false,
      block: false, cast: null }];
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

  test("debug encounter asks for a debug battle, against the enemy named if there is one", () => {
    assert.deepEqual(handle({ t: "debug", cmd: "encounter" }), [["debugEncounter", undefined]]);
    assert.deepEqual(handle({ t: "debug", cmd: "encounter", enemy: "kobold-swordsman" }),
      [["debugEncounter", "kobold-swordsman"]]);
  });

  test("every session message type has a handler", () => {
    const types: SessionMsg["t"][] = [
      "input", "battleInput", "battleResync", "leaveBattle", "settings", "character", "rest", "useItem", "moveItem",
      "closeBag", "debug",
    ];
    assert.deepEqual(Object.keys(handlers).sort(), [...types].sort());
  });
});
