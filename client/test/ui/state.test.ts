import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { bagHasTheKeys, inWorld, UiState, type TitleState } from "../../src/ui/state.js";

const texts = (ui: UiState) => ui.toasts.get().items.map((t) => t.text);

describe("UiState toasts", () => {
  test("toasts stack up in the order shown", () => {
    const ui = new UiState();
    ui.showToast("a");
    ui.showToast("b");
    assert.deepEqual(texts(ui), ["a", "b"]);
  });

  test("past the limit, the oldest goes first", () => {
    const ui = new UiState();
    for (let i = 0; i < 20; i++) ui.showToast(`t${i}`);
    const shown = texts(ui);
    assert.ok(shown.length >= 1 && shown.length < 20);
    assert.equal(shown.at(-1), "t19");
    assert.deepEqual(shown, Array.from({ length: shown.length }, (_, i) => `t${20 - shown.length + i}`));
  });

  test("every toast gets its own id, even with the same text", () => {
    const ui = new UiState();
    ui.showToast("same");
    ui.showToast("same");
    const [a, b] = ui.toasts.get().items;
    assert.notEqual(a!.id, b!.id);
  });

  test("dismissing removes only that toast, and works unbound", () => {
    const ui = new UiState();
    ui.showToast("a");
    ui.showToast("b");
    ui.showToast("c");
    const { dismissToast } = ui;
    dismissToast(ui.toasts.get().items[1]!.id);
    assert.deepEqual(texts(ui), ["a", "c"]);
  });

  test("dismissing an unknown id changes nothing", () => {
    const ui = new UiState();
    ui.showToast("a");
    ui.dismissToast(9999);
    assert.deepEqual(texts(ui), ["a"]);
  });
});

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

describe("UiState field panels", () => {
  test("one at a time: a panel key opens its panel, again closes it, another switches", () => {
    const ui = new UiState();
    assert.equal(ui.fieldPanel.get().open, null);
    ui.toggleFieldPanel("inventory");
    assert.equal(ui.fieldPanel.get().open, "inventory");
    ui.toggleFieldPanel("character");
    assert.equal(ui.fieldPanel.get().open, "character");
    ui.toggleFieldPanel("character");
    assert.equal(ui.fieldPanel.get().open, null);
  });

  test("closing closes whichever is open", () => {
    const ui = new UiState();
    ui.toggleFieldPanel("inventory");
    ui.closeFieldPanel();
    assert.equal(ui.fieldPanel.get().open, null);
  });
});

describe("bagHasTheKeys", () => {
  test("the open bag takes the keys on the field: you stand still while it's open", () => {
    assert.equal(bagHasTheKeys("field", "inventory"), true);
  });

  test("the character panel, no panel, or the arena leave the keys to the game", () => {
    assert.equal(bagHasTheKeys("field", "character"), false);
    assert.equal(bagHasTheKeys("field", null), false);
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
      assert.equal(inWorld("field", phase), false, phase);
      assert.equal(inWorld("battle", phase), false, phase);
    }
  });

  test("once the title is gone, the field and the arena are both in the world", () => {
    assert.equal(inWorld("field", "playing"), true);
    assert.equal(inWorld("battle", "playing"), true);
  });

  test("no game running is never in the world", () => {
    for (const phase of PHASES) assert.equal(inWorld(null, phase), false, phase);
  });
});
