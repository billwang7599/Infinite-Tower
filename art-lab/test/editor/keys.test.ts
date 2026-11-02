import assert from "node:assert/strict";
import { test } from "node:test";
import { commandFor, typingIn } from "../../src/editor/keys.js";

const press = (key: string, mods: { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean } = {}) =>
  ({ key, ctrlKey: !!mods.ctrl, metaKey: !!mods.meta, shiftKey: !!mods.shift, altKey: !!mods.alt });

test("Ctrl or Cmd with Z undoes, with Shift redoes, and Y redoes too", () => {
  assert.deepEqual(commandFor(press("z", { ctrl: true })), { do: "undo" });
  assert.deepEqual(commandFor(press("z", { meta: true })), { do: "undo" });
  assert.deepEqual(commandFor(press("Z", { ctrl: true, shift: true })), { do: "redo" });
  assert.deepEqual(commandFor(press("y", { meta: true })), { do: "redo" });
});

test("Ctrl or Cmd with S, C, X and V save, copy, cut and paste", () => {
  assert.deepEqual(commandFor(press("s", { meta: true })), { do: "save" });
  assert.deepEqual(commandFor(press("c", { ctrl: true })), { do: "copy" });
  assert.deepEqual(commandFor(press("x", { ctrl: true })), { do: "cut" });
  assert.deepEqual(commandFor(press("v", { meta: true })), { do: "paste" });
});

test("a single letter picks a tool, as in Aseprite", () => {
  const tools = { b: "pencil", e: "eraser", g: "fill", l: "line", u: "rect", m: "select", i: "picker" };
  for (const [key, tool] of Object.entries(tools)) assert.deepEqual(commandFor(press(key)), { do: "tool", tool });
  assert.deepEqual(commandFor(press("B", { shift: true })), { do: "tool", tool: "pencil" });
});

test("a tool letter with Ctrl, Cmd or Alt held picks no tool", () => {
  assert.equal(commandFor(press("b", { ctrl: true })), null);
  assert.equal(commandFor(press("e", { alt: true })), null);
});

test("Delete and Backspace clear the selection, arrows nudge it, by 8 with Shift", () => {
  assert.deepEqual(commandFor(press("Delete")), { do: "clear" });
  assert.deepEqual(commandFor(press("Backspace")), { do: "clear" });
  assert.deepEqual(commandFor(press("ArrowLeft")), { do: "nudge", dx: -1, dy: 0 });
  assert.deepEqual(commandFor(press("ArrowDown", { shift: true })), { do: "nudge", dx: 0, dy: 8 });
});

test("plus and minus zoom, with or without Shift for the plus", () => {
  assert.deepEqual(commandFor(press("+", { shift: true })), { do: "zoom", by: 1 });
  assert.deepEqual(commandFor(press("=")), { do: "zoom", by: 1 });
  assert.deepEqual(commandFor(press("-")), { do: "zoom", by: -1 });
});

test("Ctrl+A selects everything, Ctrl+D and Esc drop the selection", () => {
  assert.deepEqual(commandFor(press("a", { ctrl: true })), { do: "selectAll" });
  assert.deepEqual(commandFor(press("d", { meta: true })), { do: "deselect" });
  assert.deepEqual(commandFor(press("Escape")), { do: "deselect" });
});

test("other keys do nothing", () => {
  assert.equal(commandFor(press("q")), null);
  assert.equal(commandFor(press("F5")), null);
});

test("keys typed into a text box or a list are the box's, not the editor's", () => {
  assert.ok(typingIn({ tagName: "INPUT", type: "text" }));
  assert.ok(typingIn({ tagName: "INPUT", type: "number" }));
  assert.ok(typingIn({ tagName: "TEXTAREA" }));
  assert.ok(typingIn({ tagName: "SELECT" }));
  assert.ok(typingIn({ tagName: "DIV", isContentEditable: true }));
  assert.ok(!typingIn({ tagName: "INPUT", type: "checkbox" }));
  assert.ok(!typingIn({ tagName: "INPUT", type: "range" }));
  assert.ok(!typingIn({ tagName: "BUTTON" }));
  assert.ok(!typingIn(null));
});

test("H shows or hides the underlay", () => {
  assert.deepEqual(commandFor(press("h")), { do: "underlay" });
  assert.equal(commandFor(press("h", { ctrl: true })), null);
});
