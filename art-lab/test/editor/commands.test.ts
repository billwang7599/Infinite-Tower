import assert from "node:assert/strict";
import { test } from "node:test";
import { getPixel, setPixel, type Rgba } from "../../src/editor/bitmap.js";
import { runCommand } from "../../src/editor/commands.js";
import type { Command } from "../../src/editor/keys.js";
import { Editor } from "../../src/editor/state.js";
import type { CanvasView } from "../../src/editor/view.js";

const INK: Rgba = [9, 9, 9, 255];
const UNDER: Rgba = [5, 5, 5, 255];
const CLEAR: Rgba = [0, 0, 0, 0];

function setup() {
  const ed = new Editor();
  ed.changed = () => {};
  const zooms: number[] = [];
  const view = { zoomBy: (by: number) => zooms.push(by) } as unknown as CanvasView;
  let saves = 0;
  const run = (cmd: Command) => runCommand(cmd, ed, view, () => { saves++; });
  setPixel(ed.layer.pixels, 1, 1, INK);
  ed.selection = { x: 1, y: 1, w: 1, h: 1 };
  return { ed, run, zooms, saves: () => saves, at: (x: number, y: number) => getPixel(ed.layer.pixels, x, y) };
}

test("a pasted copy floats: nudging it moves the copy and leaves the original", () => {
  const { run, at } = setup();
  run({ do: "copy" });
  run({ do: "paste" });
  run({ do: "nudge", dx: 2, dy: 0 });
  run({ do: "nudge", dx: 0, dy: 1 });
  assert.deepEqual(at(1, 1), INK);
  assert.deepEqual(at(3, 2), INK);
  assert.deepEqual(at(3, 1), CLEAR);
});

test("a floating piece passes over what's under it without taking it along", () => {
  const { ed, run, at } = setup();
  setPixel(ed.layer.pixels, 2, 1, UNDER);
  run({ do: "nudge", dx: 1, dy: 0 });
  run({ do: "nudge", dx: 1, dy: 0 });
  assert.deepEqual(at(2, 1), UNDER);
  assert.deepEqual(at(3, 1), INK);
  assert.deepEqual(at(1, 1), CLEAR);
});

test("one undo takes back each nudge", () => {
  const { run, at } = setup();
  run({ do: "nudge", dx: 1, dy: 0 });
  run({ do: "nudge", dx: 1, dy: 0 });
  run({ do: "undo" });
  assert.deepEqual(at(2, 1), INK);
  run({ do: "undo" });
  assert.deepEqual(at(1, 1), INK);
  run({ do: "redo" });
  assert.deepEqual(at(2, 1), INK);
});

test("cut takes the selection out, paste brings it back where it was", () => {
  const { run, at } = setup();
  run({ do: "cut" });
  assert.deepEqual(at(1, 1), CLEAR);
  run({ do: "paste" });
  assert.deepEqual(at(1, 1), INK);
});

test("deleting a pasted piece leaves what it was pasted over", () => {
  const { ed, run, at } = setup();
  run({ do: "copy" });
  ed.selection = { x: 1, y: 1, w: 1, h: 1 };
  run({ do: "paste" });
  run({ do: "nudge", dx: 1, dy: 0 });
  run({ do: "clear" });
  assert.deepEqual(at(1, 1), INK);
  assert.deepEqual(at(2, 1), CLEAR);
});

test("Delete without a paste clears the selected pixels", () => {
  const { run, at } = setup();
  run({ do: "clear" });
  assert.deepEqual(at(1, 1), CLEAR);
});

test("select all, deselect, tools, zoom and save", () => {
  const { ed, run, zooms, saves } = setup();
  run({ do: "selectAll" });
  assert.deepEqual(ed.selection, { x: 0, y: 0, w: ed.doc.width, h: ed.doc.height });
  run({ do: "deselect" });
  assert.equal(ed.selection, null);
  run({ do: "nudge", dx: 1, dy: 0 });
  run({ do: "tool", tool: "fill" });
  assert.equal(ed.tool, "fill");
  run({ do: "zoom", by: -1 });
  assert.deepEqual(zooms, [-1]);
  run({ do: "save" });
  assert.equal(saves(), 1);
});
