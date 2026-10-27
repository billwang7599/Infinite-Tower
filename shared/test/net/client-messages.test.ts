import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_LOOK, MAX_INPUTS_PER_MESSAGE, MAX_KEYS_PER_ACTION, type BattleInput } from "@infinite-tower/shared";
import { parseClientMsg } from "@infinite-tower/shared/net/client-messages";

const parse = (msg: unknown) => parseClientMsg(JSON.stringify(msg));
const character = (name: string, look: object = DEFAULT_LOOK, gender: unknown = "boy") =>
  parse({ t: "character", character: { name, gender, look } });

/** One step's input: walking forward-right, aiming ahead, nothing pressed. */
const STEP: BattleInput = {
  seq: 1, moveX: 0.707, moveZ: 0.707, aimX: 0, aimZ: 1, jump: false, attack: false, dodge: false,
};
const battleInput = (...inputs: unknown[]) => parse({ t: "battleInput", inputs });

describe("parseClientMsg", () => {
  test("accepts every kind of message", () => {
    const messages = [
      { t: "input", seq: 1, moveX: 0.5, moveZ: -1 },
      { t: "battleInput", inputs: [STEP, { ...STEP, seq: 2, attack: true }] },
      { t: "leaveBattle" },
      { t: "settings", settings: { bindings: { overworld: { up: ["KeyW"] } }, camera: { sensitivity: 1.5 } } },
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

  test("there's no way to tell the server how a fight ended: the server decides it", () => {
    assert.equal(parse({ t: "battleEnd", won: true, vitals: { hp: 40, stamina: 12 } }), null);
  });

  test("battleInput: one or more steps, at most MAX_INPUTS_PER_MESSAGE", () => {
    assert.equal(battleInput(), null);
    const most = Array.from({ length: MAX_INPUTS_PER_MESSAGE }, (_, i) => ({ ...STEP, seq: i + 1 }));
    assert.deepEqual(battleInput(...most), { t: "battleInput", inputs: most });
    assert.equal(battleInput(...most, { ...STEP, seq: MAX_INPUTS_PER_MESSAGE + 1 }), null);
    assert.equal(parse({ t: "battleInput", inputs: STEP }), null, "not a list");
  });

  test("battleInput: seq is a whole number from 1", () => {
    for (const seq of [0, -1, 1.5, "2", null]) assert.equal(battleInput({ ...STEP, seq }), null, `seq ${seq}`);
  });

  test("battleInput: every field is there, with the right type", () => {
    for (const key of Object.keys(STEP)) {
      const { [key]: _, ...missing } = STEP as unknown as Record<string, unknown>;
      assert.equal(battleInput(missing), null, `without ${key}`);
    }
    assert.equal(battleInput({ ...STEP, attack: "yes" }), null);
    assert.equal(battleInput({ ...STEP, dodge: 1 }), null);
    assert.equal(battleInput({ ...STEP, moveX: "1" }), null);
    assert.equal(battleInput({ ...STEP, aimZ: null }), null);
  });

  test("battleInput: the aim is a direction (length 1), the move no longer than the keys can make", () => {
    assert.equal(battleInput({ ...STEP, aimX: 0, aimZ: 0 }), null, "no direction");
    assert.equal(battleInput({ ...STEP, aimX: 1, aimZ: 1 }), null, "longer than 1: a wider slash");
    assert.equal(battleInput({ ...STEP, aimX: 0.5, aimZ: 0 }), null);
    assert.equal(battleInput({ ...STEP, moveX: 2, moveZ: 0 }), null, "faster than walking");
    assert.equal(battleInput({ ...STEP, moveX: 1.2, moveZ: 1.2 }), null);
    // Two walk keys at once, turned by the camera: up to √2, rounded to 3 decimals.
    const diagonal = { ...STEP, moveX: 1.414, moveZ: 0 };
    assert.deepEqual(battleInput(diagonal), { t: "battleInput", inputs: [diagonal] });
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
    assert.equal(parse({ t: "settings", settings: { bindings: { overworld: { up: keys } } } }), null);
    assert.equal(parse({ t: "settings", settings: { bindings: { overworld: { up: ["K".repeat(33)] } } } }), null);
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
