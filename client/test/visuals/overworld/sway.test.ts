import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { SWAY } from "../../../src/visuals/overworld/sway.js";

describe("plants in the wind", () => {
  test("only plants sway; stone and wood stand still", () => {
    for (const kind of ["rock", "ruin", "statue", "fence", "cart", "shack"] as const) assert.equal(SWAY[kind], undefined);
    for (const kind of ["tallGrass", "reeds", "tree"] as const) assert.ok(SWAY[kind]);
  });

  test("grass moves more and faster than trees, and no tip moves more than a couple of pixels", () => {
    assert.ok(SWAY.tallGrass!.ratePerSec > SWAY.tree!.ratePerSec);
    assert.ok(SWAY.tallGrass!.tipPx >= SWAY.tree!.tipPx);
    for (const sway of Object.values(SWAY)) assert.ok(sway.tipPx <= 2);
  });
});
