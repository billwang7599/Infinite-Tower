import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { GROUPS, actionsOf, actionDef } from "../../src/settings/bindings.js";
import { keyName, mouseName } from "../../src/ui/keyNames.js";

describe("keyName", () => {
  test("letters and digits drop their prefix", () => {
    assert.equal(keyName("KeyW"), "W");
    assert.equal(keyName("Digit7"), "7");
  });

  test("symbols, arrows and sided modifiers get readable names", () => {
    assert.equal(keyName("Semicolon"), ";");
    assert.equal(keyName("ArrowLeft"), "←");
    assert.equal(keyName("ShiftLeft"), "Left Shift");
  });

  test("numpad keys say so; unknown codes are shown as they are", () => {
    assert.equal(keyName("Numpad4"), "Num 4");
    assert.equal(keyName("Space"), "Space");
    assert.equal(keyName("F5"), "F5");
  });

  test("every default key has a non-empty name", () => {
    for (const group of GROUPS) {
      for (const ref of actionsOf(group)) {
        for (const key of actionDef(ref).keys) assert.ok(keyName(key).length > 0, key);
      }
    }
  });
});

describe("mouseName", () => {
  test("names the three usual buttons and numbers the rest", () => {
    assert.equal(mouseName(0), "Left click");
    assert.equal(mouseName(2), "Right click");
    assert.equal(mouseName(3), "Mouse 4");
  });
});
