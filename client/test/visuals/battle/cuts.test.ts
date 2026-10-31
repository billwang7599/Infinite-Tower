import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { cutSteps, STANCES, type CutsData, type Stance, type SwingData } from "@infinite-tower/shared";
import { guardBlade, STANCE_BLADES } from "../../../src/visuals/battle/cuts.js";
import { swingCut, wayOfSwing } from "../../../src/visuals/battle/weapons.js";

const held = (stance: Stance): CutsData => ({ to: stance, want: stance, moveSteps: 0, fehlered: false });
const cutFrom = (stance: Stance, attack: "light" | "heavy"): SwingData => ({
  attack, side: "top", way: null, chain: 0, dir: { x: 0, z: 1 }, step: 0,
  ...cutSteps(1, attack === "heavy" ? "cut" : "strike", 0.4), damage: 0, poiseDamage: 0, posture: 0, perilous: null,
  line: null, punch: false, stance,
});
const angle = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  Math.acos(Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));

describe("Master Cuts, drawn", () => {
  test("its four guards hold the blade at very different angles: Vom Tag up, Alber down, Ochs and Pflug ahead", () => {
    for (const a of STANCES) {
      for (const b of STANCES) if (a !== b) assert.ok(angle(STANCE_BLADES[a].blade, STANCE_BLADES[b].blade) > 0.5);
    }
    assert.ok(STANCE_BLADES["vom-tag"].blade.y > 0.7);
    assert.ok(STANCE_BLADES.alber.blade.y < -0.5);
    assert.ok(STANCE_BLADES.ochs.blade.z > 0.5 && STANCE_BLADES.pflug.blade.z > 0.5);
    assert.ok(STANCE_BLADES.ochs.handY! > STANCE_BLADES.pflug.handY!, "Ochs by the head, Pflug at the hip");
    assert.deepEqual(guardBlade(held("ochs")), STANCE_BLADES.ochs);
  });

  test("each attack sweeps its own way: the Oberhau and the Scheitelhau down, the stiche ahead, the Zwerchhau flat", () => {
    assert.equal(wayOfSwing(cutFrom("vom-tag", "light")), "tb");
    assert.equal(wayOfSwing(cutFrom("vom-tag", "heavy")), "tb");
    assert.equal(wayOfSwing(cutFrom("ochs", "light")), "stab");
    assert.equal(wayOfSwing(cutFrom("pflug", "light")), "stab");
    assert.equal(wayOfSwing(cutFrom("alber", "light")), "bt");
    assert.equal(wayOfSwing(cutFrom("pflug", "heavy")), "rl");
    assert.equal(swingCut(cutFrom("pflug", "heavy")).y, 0);
    assert.equal(wayOfSwing({ ...cutFrom("ochs", "light"), stance: null, way: null }), null);
  });
});
