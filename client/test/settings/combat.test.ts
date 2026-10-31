import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_COMBAT_STYLE } from "@infinite-tower/shared";
import { CombatSettings } from "../../src/settings/combat.js";
import { createSettings, restoreSettings } from "../../src/settings/settings.js";

describe("CombatSettings", () => {
  test("starts on the default style, which isn't saved", () => {
    const combat = new CombatSettings();
    assert.equal(combat.get().style, DEFAULT_COMBAT_STYLE);
    assert.deepEqual(combat.toSaved(), {});
  });

  test("a style picked is saved, and comes back", () => {
    const combat = new CombatSettings();
    combat.setStyle("hybrid");
    assert.deepEqual(combat.toSaved(), { style: "hybrid" });
    const again = new CombatSettings();
    again.restore(combat.toSaved());
    assert.equal(again.get().style, "hybrid");
  });

  test("a save from before it existed, or with a style that's gone, reads as the default", () => {
    for (const saved of [undefined, {}, { style: "mordhau" as never }]) {
      const combat = new CombatSettings();
      combat.setStyle("hybrid");
      combat.restore(saved);
      assert.equal(combat.get().style, DEFAULT_COMBAT_STYLE);
    }
  });

  test("is one of the settings, restored with the rest", () => {
    const settings = createSettings();
    restoreSettings(settings, { combat: { style: "hybrid" } });
    assert.equal(settings.combat.get().style, "hybrid");
    restoreSettings(settings, {});
    assert.equal(settings.combat.get().style, DEFAULT_COMBAT_STYLE);
  });
});
