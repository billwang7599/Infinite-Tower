import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_LOOK, MAX_KEYS_PER_ACTION } from "@infinite-tower/shared";
import { parseClientMsg } from "@infinite-tower/shared/net/client-messages";

const parse = (msg: unknown) => parseClientMsg(JSON.stringify(msg));
const character = (name: string, look: object = DEFAULT_LOOK, gender: unknown = "boy") =>
  parse({ t: "character", character: { name, gender, look } });

describe("parseClientMsg", () => {
  test("accepts every kind of message", () => {
    const messages = [
      { t: "input", seq: 1, moveX: 0.5, moveZ: -1 },
      { t: "battleEnd", won: true, vitals: { hp: 40, stamina: 12 } },
      { t: "settings", settings: { bindings: { field: { up: ["KeyW"] } }, camera: { sensitivity: 1.5 } } },
      { t: "settings", settings: {} },
      { t: "settings", settings: { mouse: { autoLock: false } } },
      { t: "character", character: { name: "Kirito", gender: "boy", look: DEFAULT_LOOK } },
      { t: "rest" },
      { t: "useItem", at: { x: 2, y: 1 } },
      { t: "moveItem", from: { x: 0, y: 0 }, to: { x: 3, y: 2 }, turned: true },
      { t: "debug", cmd: "encounter" },
    ];
    for (const msg of messages) assert.deepEqual(parse(msg), msg, JSON.stringify(msg));
  });

  test("drops anything that isn't JSON, or isn't a known message", () => {
    assert.equal(parseClientMsg("{not json"), null);
    assert.equal(parse(null), null);
    assert.equal(parse({ t: "teleport", x: 0 }), null);
    assert.equal(parse({ seq: 1, moveX: 0, moveZ: 0 }), null);
  });

  test("input: seq is a whole number, not negative", () => {
    assert.equal(parse({ t: "input", seq: -1, moveX: 0, moveZ: 0 }), null);
    assert.equal(parse({ t: "input", seq: 1.5, moveX: 0, moveZ: 0 }), null);
    assert.equal(parse({ t: "input", seq: 1, moveX: "1", moveZ: 0 }), null);
  });

  test("character: the name follows the rules and is trimmed", () => {
    assert.deepEqual(
      character("  Asuna  ", DEFAULT_LOOK, "girl"),
      { t: "character", character: { name: "Asuna", gender: "girl", look: DEFAULT_LOOK } },
    );
    assert.equal(character("A"), null, "too short");
    assert.equal(character("A".repeat(17)), null, "too long");
    assert.equal(character("<script>"), null, "characters outside the rules");
  });

  test("character: every look part must be one of the options", () => {
    assert.equal(character("Asuna", { ...DEFAULT_LOOK, hairColor: "rainbow" }), null);
    const { mouth: _, ...noMouth } = DEFAULT_LOOK;
    assert.equal(character("Asuna", noMouth), null, "a part missing");
    assert.equal(character("Asuna", { cloak: "red", skin: "light", legs: "navy" }), null, "the old look");
  });

  test("character: gender is boy or girl, and required", () => {
    assert.equal(character("Asuna", DEFAULT_LOOK, "other"), null);
    assert.equal(parse({ t: "character", character: { name: "Asuna", look: DEFAULT_LOOK } }), null, "no gender");
  });

  test("settings: limits on bindings", () => {
    const keys = Array.from({ length: MAX_KEYS_PER_ACTION + 1 }, (_, i) => `Key${i}`);
    assert.equal(parse({ t: "settings", settings: { bindings: { field: { up: keys } } } }), null);
    assert.equal(parse({ t: "settings", settings: { bindings: { field: { up: ["K".repeat(33)] } } } }), null);
  });

  test("settings: the mouse auto lock is kept as saved, may be left out (on), and must be true or false", () => {
    const settings = (saved: object) => parse({ t: "settings", settings: saved });
    for (const autoLock of [false, true]) {
      const saved = { camera: { sensitivity: 2 }, mouse: { autoLock } };
      assert.deepEqual(settings(saved), { t: "settings", settings: saved });
    }
    // Saved before the setting existed: still valid, and the client reads the missing field as on.
    assert.deepEqual(settings({ mouse: {} }), { t: "settings", settings: { mouse: {} } });
    for (const autoLock of ["false", 0, null]) assert.equal(settings({ mouse: { autoLock } }), null);
  });

  test("useItem and moveItem: cells are whole, non-negative numbers", () => {
    assert.equal(parse({ t: "useItem", item: "boar-meat" }), null);
    assert.equal(parse({ t: "useItem", at: { x: -1, y: 0 } }), null);
    assert.equal(parse({ t: "useItem", at: { x: 0.5, y: 0 } }), null);
    assert.equal(parse({ t: "moveItem", from: { x: 0, y: 0 }, to: { x: 1, y: "1" }, turned: false }), null);
    assert.equal(parse({ t: "moveItem", from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }), null);
  });

  test("debug: only known commands", () => {
    assert.equal(parse({ t: "debug", cmd: "godmode" }), null);
  });
});
