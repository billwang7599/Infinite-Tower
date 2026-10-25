import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { UiState } from "../../src/ui/state.js";

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

  test("the character editor opened from the field can be closed", () => {
    const ui = new UiState();
    ui.openCharacterEditor();
    assert.deepEqual(ui.characterScreen.get(), { open: true, firstTime: false });
    ui.closeCharacterEditor();
    assert.equal(ui.characterScreen.get().open, false);
  });

  test("the first-visit character editor can't be closed", () => {
    const ui = new UiState();
    ui.characterScreen.set({ open: true, firstTime: true });
    ui.closeCharacterEditor();
    assert.equal(ui.characterScreen.get().open, true);
  });
});
