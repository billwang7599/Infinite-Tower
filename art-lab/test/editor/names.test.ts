import assert from "node:assert/strict";
import { test } from "node:test";
import { isSaveName, toSaveName } from "../../src/editor/names.js";

test("a save name is letters, digits, - and _, starting with a letter or digit", () => {
  assert.ok(isSaveName("boar-walk_2"));
  for (const bad of ["", "-x", "a b", "a/b", "..", "a.png", "x".repeat(65)]) assert.ok(!isSaveName(bad), bad);
});

test("any text becomes a save name", () => {
  assert.equal(toSaveName("Portrait: medium, soft"), "portrait-medium-soft");
  assert.equal(toSaveName("../.."), "drawing");
  assert.ok(isSaveName(toSaveName("x".repeat(100))));
});
