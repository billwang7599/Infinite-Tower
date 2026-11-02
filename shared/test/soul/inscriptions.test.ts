import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  carve, CORE_STEPS, coreAfterDeath, coreStats, INSCRIPTION_IDS, INSCRIPTIONS, inscriptionSlots, itemDef, keptCore,
  newCore, REALMS, sigilOf, STEP_NAMES, uncarve, type CoreState,
} from "@infinite-tower/shared";

const at = (steps: number, inscriptions: CoreState["inscriptions"] = []): CoreState =>
  ({ steps, fill: 0, points: {}, inscriptions });

describe("inscription slots", () => {
  test("Early Yan holds one, each step one more, the first step of each new realm two", () => {
    assert.equal(inscriptionSlots(newCore()), 1);
    assert.equal(inscriptionSlots(at(1)), 2);
    assert.equal(inscriptionSlots(at(STEP_NAMES.length - 1)), STEP_NAMES.length);
    assert.equal(inscriptionSlots(at(STEP_NAMES.length)), STEP_NAMES.length + 2);
  });

  test("Peak Tian holds one a step plus a breakthrough into each later realm, and a whole core no more", () => {
    const most = CORE_STEPS + REALMS.length - 1;
    assert.equal(inscriptionSlots(at(CORE_STEPS - 1)), most);
    assert.equal(inscriptionSlots(at(CORE_STEPS)), most);
  });
});

describe("carving", () => {
  test("adds the inscription while a slot is free, never the same one twice", () => {
    const carved = carve(at(1), "grit")!;
    assert.deepEqual(carved.inscriptions, ["grit"]);
    assert.equal(carve(carved, "grit"), null);
    assert.deepEqual(carve(carved, "embers")!.inscriptions, ["grit", "embers"]);
    assert.equal(carve(at(0, ["grit"]), "embers"), null);
  });

  test("taking one off leaves the rest", () => {
    assert.deepEqual(uncarve(at(1, ["grit", "embers"]), "grit")!.inscriptions, ["embers"]);
    assert.equal(uncarve(at(1, ["embers"]), "grit"), null);
  });

  test("each inscription has one sigil that names it", () => {
    for (const id of INSCRIPTION_IDS) assert.equal(itemDef(sigilOf(id)).inscription, id);
  });
});

describe("an inscribed core", () => {
  test("Grit's stats are added to the core's", () => {
    const plain = coreStats(newCore()), gritty = coreStats(at(0, ["grit"]));
    for (const [stat, gain] of Object.entries(INSCRIPTIONS.grit.stats) as [keyof typeof plain, number][]) {
      assert.equal(gritty[stat], plain[stat] + gain, stat);
    }
  });

  test("death keeps every inscription, even past the slots a lost step leaves", () => {
    const full = at(1, ["grit", "embers"]);
    assert.deepEqual(coreAfterDeath({ ...full, fill: 5 }).inscriptions, full.inscriptions);
    const lost = coreAfterDeath(full);
    assert.equal(lost.steps, 0);
    assert.deepEqual(lost.inscriptions, full.inscriptions);
    assert.equal(carve(lost, "red-blade"), null);
  });

  test("a saved core keeps only known inscriptions, once each", () => {
    const saved = { steps: 3, fill: 0, points: {}, inscriptions: ["grit", "grit", "nonsense", "embers", 7] };
    assert.deepEqual(keptCore(saved).inscriptions, ["grit", "embers"]);
    assert.deepEqual(keptCore({ steps: 0, fill: 0, points: {} }).inscriptions, []);
  });
});
