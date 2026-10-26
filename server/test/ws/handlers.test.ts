import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { dispatch, type ClientMsg } from "@infinite-tower/shared";
import type { GameSession } from "../../src/core/game/session.js";
import { handlers } from "../../src/ws/handlers.js";
import { TEST_CHARACTER } from "../fixtures/level.js";

type Call = [method: string, ...args: unknown[]];

/** Stands in for a GameSession: records each method called on it, with its arguments. */
function fakeSession() {
  const calls: Call[] = [];
  const record = (method: string) => (...args: unknown[]) => { calls.push([method, ...args]); };
  const session = {
    input: record("input"),
    endBattle: record("endBattle"),
    setSettings: record("setSettings"),
    setCharacter: record("setCharacter"),
    rest: record("rest"),
    useItem: record("useItem"),
    moveItem: record("moveItem"),
    debugEncounter: record("debugEncounter"),
  };
  return { calls, session: session as unknown as GameSession };
}

function handle(msg: ClientMsg): Call[] {
  const { calls, session } = fakeSession();
  dispatch(handlers, msg, session);
  return calls;
}

describe("message handlers", () => {
  test("input walks with its seq and direction", () => {
    assert.deepEqual(handle({ t: "input", seq: 7, moveX: -1, moveZ: 0.5 }), [["input", 7, -1, 0.5]]);
  });

  test("battleEnd reports the claimed result and vitals", () => {
    const vitals = { hp: 40, stamina: 12 };
    assert.deepEqual(handle({ t: "battleEnd", won: true, vitals }), [["endBattle", true, vitals]]);
    assert.deepEqual(handle({ t: "battleEnd", won: false, vitals }), [["endBattle", false, vitals]]);
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
    assert.deepEqual(handle({ t: "useItem", at: { x: 1, y: 2 } }), [["useItem", { x: 1, y: 2 }]]);
  });

  test("moveItem moves from one cell to another, turned or not", () => {
    const from = { x: 0, y: 0 }, to = { x: 2, y: 1 };
    assert.deepEqual(handle({ t: "moveItem", from, to, turned: true }), [["moveItem", from, to, true]]);
  });

  test("debug encounter asks for a debug battle", () => {
    assert.deepEqual(handle({ t: "debug", cmd: "encounter" }), [["debugEncounter"]]);
  });

  test("every client message type has a handler", () => {
    const types: ClientMsg["t"][] = [
      "input", "battleEnd", "settings", "character", "rest", "useItem", "moveItem", "debug",
    ];
    assert.deepEqual(Object.keys(handlers).sort(), [...types].sort());
  });
});
