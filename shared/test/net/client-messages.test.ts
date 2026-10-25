import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_LOOK, ITEM_IDS, MAX_KEYS_PER_ACTION } from "@infinite-tower/shared";
import { parseClientMsg } from "@infinite-tower/shared/net/client-messages";

const parse = (msg: unknown) => parseClientMsg(JSON.stringify(msg));
const character = (name: string, look: object = DEFAULT_LOOK) => parse({ t: "character", character: { name, look } });

describe("parseClientMsg", () => {
  test("accepts every kind of message", () => {
    const messages = [
      { t: "input", seq: 1, moveX: 0.5, moveZ: -1 },
      { t: "battleEnd", won: true, vitals: { hp: 40, stamina: 12 } },
      { t: "settings", settings: { bindings: { field: { up: ["KeyW"] } }, camera: { sensitivity: 1.5 } } },
      { t: "settings", settings: {} },
      { t: "character", character: { name: "Kirito", look: DEFAULT_LOOK } },
      { t: "rest" },
      { t: "useItem", item: ITEM_IDS[0] },
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
    assert.deepEqual(character("  Asuna  "), { t: "character", character: { name: "Asuna", look: DEFAULT_LOOK } });
    assert.equal(character("A"), null, "too short");
    assert.equal(character("A".repeat(17)), null, "too long");
    assert.equal(character("<script>"), null, "characters outside the rules");
  });

  test("character: every look part must be one of the options", () => {
    assert.equal(character("Asuna", { ...DEFAULT_LOOK, cloak: "rainbow" }), null);
    assert.equal(character("Asuna", { cloak: "red", skin: "light" }), null);
  });

  test("settings: limits on bindings", () => {
    const keys = Array.from({ length: MAX_KEYS_PER_ACTION + 1 }, (_, i) => `Key${i}`);
    assert.equal(parse({ t: "settings", settings: { bindings: { field: { up: keys } } } }), null);
    assert.equal(parse({ t: "settings", settings: { bindings: { field: { up: ["K".repeat(33)] } } } }), null);
  });

  test("useItem: only items that exist", () => {
    assert.equal(parse({ t: "useItem", item: "elixir" }), null);
  });

  test("debug: only known commands", () => {
    assert.equal(parse({ t: "debug", cmd: "godmode" }), null);
  });
});
