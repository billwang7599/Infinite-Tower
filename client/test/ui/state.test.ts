import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { bagHasTheKeys, inWorld, UiState, type TitleState } from "../../src/ui/state.js";

describe("UiState screens", () => {
  test("settings open and close", () => {
    const ui = new UiState();
    ui.openSettings();
    assert.equal(ui.settingsScreen.get().open, true);
    ui.closeSettings();
    assert.equal(ui.settingsScreen.get().open, false);
  });

  test("the creation screen closes itself when it's done", () => {
    const ui = new UiState();
    ui.creation.set({ open: true });
    ui.closeCreation();
    assert.equal(ui.creation.get().open, false);
  });
});

describe("UiState overworld panels", () => {
  test("one at a time: a panel key opens its panel, again closes it, another switches", () => {
    const ui = new UiState();
    assert.equal(ui.overworldPanel.get().open, null);
    ui.toggleOverworldPanel("inventory");
    assert.equal(ui.overworldPanel.get().open, "inventory");
    ui.toggleOverworldPanel("character");
    assert.equal(ui.overworldPanel.get().open, "character");
    ui.toggleOverworldPanel("character");
    assert.equal(ui.overworldPanel.get().open, null);
  });

  test("closing closes whichever is open", () => {
    const ui = new UiState();
    ui.toggleOverworldPanel("inventory");
    ui.closeOverworldPanel();
    assert.equal(ui.overworldPanel.get().open, null);
  });
});

describe("bagHasTheKeys", () => {
  test("the open bag takes the keys on the overworld: you stand still while it's open", () => {
    assert.equal(bagHasTheKeys("overworld", "inventory"), true);
  });

  test("the character panel, no panel, or the arena leave the keys to the game", () => {
    assert.equal(bagHasTheKeys("overworld", "character"), false);
    assert.equal(bagHasTheKeys("overworld", null), false);
    assert.equal(bagHasTheKeys("battle", "inventory"), false);
    assert.equal(bagHasTheKeys(null, "inventory"), false);
  });
});

describe("inWorld", () => {
  const PHASES: readonly TitleState["phase"][] = [
    "checking", "menu", "signingIn", "connecting", "loading", "failed", "entering", "playing", "returning",
  ];

  test("HUDs and key-taking screens wait for the title to clear, and go as it comes back", () => {
    for (const phase of PHASES.filter((p) => p !== "playing")) {
      assert.equal(inWorld("overworld", phase), false, phase);
      assert.equal(inWorld("battle", phase), false, phase);
    }
  });

  test("once the title is gone, the overworld and the arena are both in the world", () => {
    assert.equal(inWorld("overworld", "playing"), true);
    assert.equal(inWorld("battle", "playing"), true);
  });

  test("no game running is never in the world", () => {
    for (const phase of PHASES) assert.equal(inWorld(null, phase), false, phase);
  });
});
