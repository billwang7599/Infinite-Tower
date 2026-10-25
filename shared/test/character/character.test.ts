import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_LOOK, LOOK_PARTS, LOOKS, lookColors, type Look } from "@infinite-tower/shared";

test("the default look is made of real options", () => {
  for (const part of LOOK_PARTS) {
    assert.ok(LOOKS[part].some((o) => o.id === DEFAULT_LOOK[part]), part);
  }
});

test("option ids are unique within each part", () => {
  for (const part of LOOK_PARTS) {
    const ids = LOOKS[part].map((o) => o.id);
    assert.equal(new Set(ids).size, ids.length, part);
  }
});

test("lookColors finds the chosen option, and falls back to the first for an unknown one", () => {
  assert.equal(lookColors("skin", { ...DEFAULT_LOOK, skin: "dark" }), LOOKS.skin.find((o) => o.id === "dark")!.colors);
  const stale = { ...DEFAULT_LOOK, legs: "plaid" } as unknown as Look;
  assert.equal(lookColors("legs", stale), LOOKS.legs[0].colors);
});
