import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_LOOK, LOOK_OPTIONS, LOOK_PARTS } from "@infinite-tower/shared";

test("the default look is made of real options", () => {
  for (const part of LOOK_PARTS) {
    assert.ok((LOOK_OPTIONS[part] as readonly string[]).includes(DEFAULT_LOOK[part]), part);
  }
});

test("option ids are unique within each part, and every part has a choice", () => {
  for (const part of LOOK_PARTS) {
    const ids = LOOK_OPTIONS[part];
    assert.equal(new Set(ids).size, ids.length, part);
    assert.ok(ids.length >= 2, part);
  }
});
