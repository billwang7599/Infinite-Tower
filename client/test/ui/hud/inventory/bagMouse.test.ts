import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ITEMS, type Bag, type BagItem, type ItemId } from "@infinite-tower/shared";
import {
  canDrop, cancel, DRAG_START_PX, doubleClick, hoveredStack, itemToUse, keepUp, landing, NO_MOUSE, pointerDown,
  pointerMove, pointerUp, rightPress, selectedStack, tick, TOOLTIP_DELAY_MS, turnInPlace, turnKey,
  type BagMouse, type Pointer,
} from "../../../../src/ui/hud/inventory/bagMouse.js";

const bag = (cols: number, rows: number, ...items: BagItem[]): Bag => ({ cols, rows, items });
const stack = (item: ItemId, x: number, y: number, count = 1, turned = false): BagItem =>
  ({ item, count, x, y, turned });

/** A 6x4 bag: meat x3 at 0,0; a hide at 2,0 (2x2); a tusk standing at 5,0 (1x2). */
const BAG = bag(6, 4, stack("boar-meat", 0, 0, 3), stack("boar-hide", 2, 0), stack("boar-tusk", 5, 0));

/** Pixels per cell, for these tests only: the logic works in whatever pixels the grid gives it. */
const PX = 10;
/** The pointer over cell x,y (in its middle, nudged by dx,dy pixels). Off the bag's cells, it's outside. */
const over = (x: number, y: number, dx = 0, dy = 0, b: Bag = BAG): Pointer => ({
  cell: { x, y }, inside: x >= 0 && y >= 0 && x < b.cols && y < b.rows,
  x: (x + 0.5) * PX + dx, y: (y + 0.5) * PX + dy,
});
const FAR = DRAG_START_PX + 1;

/** Press on a cell and move just far enough to start dragging. */
function dragFrom(x: number, y: number, b: Bag = BAG, m: BagMouse = NO_MOUSE): BagMouse {
  return pointerMove(pointerDown(m, b, over(x, y, 0, 0, b)), b, over(x, y, FAR, 0, b), 0);
}
/** Press and let go without moving: a click. */
const click = (m: BagMouse, x: number, y: number, b: Bag = BAG) =>
  pointerUp(pointerDown(m, b, over(x, y, 0, 0, b)), b, over(x, y, 0, 0, b), 0).mouse;

describe("hover", () => {
  test("the stack under the pointer is hovered, whichever of its cells it's on", () => {
    assert.equal(hoveredStack(pointerMove(NO_MOUSE, BAG, over(3, 1), 0), BAG)?.item, "boar-hide");
    assert.equal(hoveredStack(pointerMove(NO_MOUSE, BAG, over(5, 1), 0), BAG)?.item, "boar-tusk");
  });

  test("nothing is hovered over an empty cell, off the grid, or after the pointer leaves", () => {
    assert.equal(hoveredStack(pointerMove(NO_MOUSE, BAG, over(1, 3), 0), BAG), null);
    assert.equal(hoveredStack(pointerMove(NO_MOUSE, BAG, over(-1, 0), 0), BAG), null);
    const left = pointerMove(pointerMove(NO_MOUSE, BAG, over(0, 0), 0), BAG, null, 10);
    assert.equal(hoveredStack(left, BAG), null);
  });

  test("hovering doesn't select", () => {
    assert.equal(selectedStack(pointerMove(NO_MOUSE, BAG, over(0, 0), 0), BAG), null);
  });
});

describe("the tooltip", () => {
  const rested = (m: BagMouse) => m.hover?.tooltip ?? false;

  test("shows after the pointer rests on a stack long enough", () => {
    const m = pointerMove(NO_MOUSE, BAG, over(0, 0), 1000);
    assert.equal(rested(tick(m, 1000 + TOOLTIP_DELAY_MS - 1)), false);
    assert.equal(rested(tick(m, 1000 + TOOLTIP_DELAY_MS)), true);
  });

  test("moving before it shows starts the wait again", () => {
    const m = pointerMove(pointerMove(NO_MOUSE, BAG, over(0, 0), 1000), BAG, over(0, 0, 1, 1), 1400);
    assert.equal(rested(tick(m, 1000 + TOOLTIP_DELAY_MS)), false);
    assert.equal(rested(tick(m, 1400 + TOOLTIP_DELAY_MS)), true);
  });

  test("once up, it stays while the pointer moves over the same stack", () => {
    const up = tick(pointerMove(NO_MOUSE, BAG, over(2, 0), 0), TOOLTIP_DELAY_MS);
    assert.equal(rested(pointerMove(up, BAG, over(3, 1), TOOLTIP_DELAY_MS + 50)), true);
  });

  test("moving onto another stack, empty space or off the grid hides it", () => {
    const up = tick(pointerMove(NO_MOUSE, BAG, over(2, 0), 0), TOOLTIP_DELAY_MS);
    const later = TOOLTIP_DELAY_MS + 50;
    assert.equal(rested(pointerMove(up, BAG, over(5, 0), later)), false);
    assert.equal(rested(pointerMove(up, BAG, over(1, 3), later)), false);
    assert.equal(rested(pointerMove(up, BAG, null, later)), false);
  });

  test("a drag hides it, and it doesn't come back while dragging", () => {
    const up = tick(pointerMove(NO_MOUSE, BAG, over(0, 0), 0), TOOLTIP_DELAY_MS);
    const dragging = dragFrom(0, 0, BAG, up);
    assert.equal(rested(dragging), false);
    assert.equal(rested(tick(dragging, 10 * TOOLTIP_DELAY_MS)), false);
  });
});

describe("select", () => {
  test("a click on a stack selects it", () => {
    assert.deepEqual(click(NO_MOUSE, 3, 1).selected, { x: 2, y: 0 });
    assert.equal(selectedStack(click(NO_MOUSE, 3, 1), BAG)?.item, "boar-hide");
  });

  test("a click on the selected stack, or on empty space, deselects", () => {
    const hide = click(NO_MOUSE, 2, 0);
    assert.equal(click(hide, 3, 1).selected, null);
    assert.equal(click(hide, 1, 3).selected, null);
  });

  test("a click on another stack selects that one instead", () => {
    assert.deepEqual(click(click(NO_MOUSE, 2, 0), 5, 1).selected, { x: 5, y: 0 });
  });

  test("a press that moves a little (under the drag threshold) is still a click", () => {
    const pressed = pointerDown(NO_MOUSE, BAG, over(0, 0));
    const wobbled = pointerMove(pressed, BAG, over(0, 0, DRAG_START_PX - 1, 0), 0);
    assert.equal(wobbled.drag, null);
    assert.deepEqual(pointerUp(wobbled, BAG, over(0, 0, DRAG_START_PX - 1, 0), 0).mouse.selected, { x: 0, y: 0 });
  });

  test("selected, hovered and dragged are kept apart", () => {
    const m = pointerMove(click(NO_MOUSE, 0, 0), BAG, over(5, 1), 0);
    assert.equal(selectedStack(m, BAG)?.item, "boar-meat");
    assert.equal(hoveredStack(m, BAG)?.item, "boar-tusk");
    assert.equal(m.drag, null);
  });
});

describe("drag", () => {
  test("starts once a press on a stack moves past the threshold, held by the pressed cell", () => {
    const m = dragFrom(3, 1);
    assert.deepEqual(m.drag, { from: { x: 2, y: 0 }, item: "boar-hide", turned: false, grip: { x: 1, y: 1 } });
  });

  test("dragging selects the stack, and nothing is hovered meanwhile", () => {
    const m = dragFrom(5, 0, BAG, click(NO_MOUSE, 0, 0));
    assert.deepEqual(m.selected, { x: 5, y: 0 });
    assert.equal(hoveredStack(m, BAG), null);
  });

  test("a press on empty space never drags", () => {
    const m = pointerMove(pointerDown(NO_MOUSE, BAG, over(1, 3)), BAG, over(3, 3), 0);
    assert.equal(m.drag, null);
  });

  test("it would land under the pointer, offset by where it was held, kept inside the bag", () => {
    const hide = dragFrom(3, 1);
    assert.deepEqual(landing(pointerMove(hide, BAG, over(1, 3), 0), BAG), { x: 0, y: 2 });
    assert.deepEqual(landing(pointerMove(hide, BAG, over(0, 0), 0), BAG), { x: 0, y: 0 }, "held by its far corner");
    const tusk = dragFrom(5, 0);
    assert.deepEqual(landing(pointerMove(tusk, BAG, over(1, 3), 0), BAG), { x: 1, y: 2 }, "can't stick out below");
  });

  test("off the grid it has nowhere to land, so it doesn't fit", () => {
    const m = pointerMove(dragFrom(0, 0), BAG, over(-2, 1), 0);
    assert.equal(landing(m, BAG), null);
    assert.equal(canDrop(m, BAG), false);
  });

  test("fits on free cells and where it came from; not over another item", () => {
    const tusk = dragFrom(5, 0);
    assert.equal(canDrop(pointerMove(tusk, BAG, over(0, 2), 0), BAG), true);
    assert.equal(canDrop(pointerMove(tusk, BAG, over(5, 0), 0), BAG), true);
    assert.equal(canDrop(pointerMove(tusk, BAG, over(3, 0), 0), BAG), false);
  });

  test("dropped on free cells: a move for the server, and the moved stack stays selected", () => {
    const m = pointerMove(dragFrom(5, 0), BAG, over(0, 2), 0);
    const { mouse, move } = pointerUp(m, BAG, over(0, 2), 0);
    assert.deepEqual(move, { from: { x: 5, y: 0 }, to: { x: 0, y: 2 }, turned: false });
    assert.equal(mouse.drag, null);
    assert.deepEqual(mouse.selected, { x: 0, y: 2 });
  });

  test("dropped over another item: no move, it snaps back and stays selected", () => {
    const m = pointerMove(dragFrom(5, 0), BAG, over(3, 0), 0);
    const { mouse, move } = pointerUp(m, BAG, over(3, 0), 0);
    assert.equal(move, null);
    assert.equal(mouse.drag, null);
    assert.deepEqual(mouse.selected, { x: 5, y: 0 });
  });

  test("dropped off the grid: no move, it snaps back", () => {
    const m = pointerMove(dragFrom(0, 0), BAG, over(9, 9), 0);
    const { mouse, move } = pointerUp(m, BAG, over(9, 9), 0);
    assert.equal(move, null);
    assert.equal(mouse.drag, null);
  });

  test("dropped where it came from: nothing to send", () => {
    const { mouse, move } = pointerUp(pointerMove(dragFrom(0, 0), BAG, over(0, 0), 0), BAG, over(0, 0), 0);
    assert.equal(move, null);
    assert.deepEqual(mouse.selected, { x: 0, y: 0 });
  });

  test("onto a stack of the same item that has room: a move (the server tops it up)", () => {
    const two = bag(6, 4, stack("boar-meat", 0, 0, 3), stack("boar-meat", 1, 0, 1));
    const m = pointerMove(dragFrom(1, 0, two), two, over(0, 0, 0, 0, two), 0);
    assert.equal(canDrop(m, two), true);
    const { move } = pointerUp(m, two, over(0, 0, 0, 0, two), 0);
    assert.deepEqual(move, { from: { x: 1, y: 0 }, to: { x: 0, y: 0 }, turned: false });
  });

  test("onto a full stack: it doesn't fit", () => {
    const full = ITEMS["boar-meat"].stackSize;
    const two = bag(6, 4, stack("boar-meat", 0, 0, full), stack("boar-meat", 1, 0, 1));
    assert.equal(canDrop(pointerMove(dragFrom(1, 0, two), two, over(0, 0, 0, 0, two), 0), two), false);
  });

  test("cancelling (settings opened over the bag) drops the drag; the item stays where it was", () => {
    const m = cancel(pointerMove(dragFrom(0, 0), BAG, over(1, 3), 0));
    assert.equal(m.drag, null);
    assert.equal(m.press, null);
  });
});

describe("turn", () => {
  test("while dragging, R or a right press turns the dragged item and the grip with it", () => {
    for (const turn of [turnKey, rightPress]) {
      const { mouse, move } = turn(pointerMove(dragFrom(5, 1), BAG, over(0, 3), 0), BAG);
      assert.equal(move, null, turn.name);
      assert.deepEqual(mouse.drag, { from: { x: 5, y: 0 }, item: "boar-tusk", turned: true, grip: { x: 1, y: 0 } });
    }
  });

  test("a turn while dragging changes where it fits", () => {
    // The tusk held by its lower cell, pointing at 1,3: standing it covers 1,2-1,3; lying it covers 0,3-1,3.
    const m = pointerMove(dragFrom(5, 1), BAG, over(1, 3), 0);
    const blocked = bag(6, 4, ...BAG.items, stack("boar-meat", 0, 3));
    assert.equal(canDrop(m, blocked), true);
    assert.equal(canDrop(turnKey(m, blocked).mouse, blocked), false);
  });

  test("R with nothing dragged turns the selected item in place, if it fits turned", () => {
    const tusk = click(NO_MOUSE, 5, 0);
    const lone = bag(6, 4, stack("boar-tusk", 4, 0));
    const { move } = turnKey(click(NO_MOUSE, 4, 0, lone), lone);
    assert.deepEqual(move, { from: { x: 4, y: 0 }, to: { x: 4, y: 0 }, turned: true });
    assert.equal(turnKey(tusk, BAG).move, null, "lying across from 5,0 it would stick out of the bag");
    assert.equal(turnKey(NO_MOUSE, BAG).move, null, "nothing selected");
  });

  test("a right press with nothing dragged turns the item under the pointer in place, selected or not", () => {
    const lone = bag(6, 4, stack("boar-tusk", 2, 1), stack("boar-meat", 0, 0));
    const m = pointerMove(click(NO_MOUSE, 0, 0, lone), lone, over(2, 2, 0, 0, lone), 0);
    const { mouse, move } = rightPress(m, lone);
    assert.deepEqual(move, { from: { x: 2, y: 1 }, to: { x: 2, y: 1 }, turned: true });
    assert.deepEqual(mouse.selected, { x: 0, y: 0 });
    assert.equal(rightPress(pointerMove(NO_MOUSE, lone, over(4, 3, 0, 0, lone), 0), lone).move, null, "empty cell");
  });

  test("turning in place: a move to the same top-left, turned flipped, only where the turned shape fits", () => {
    assert.deepEqual(turnInPlace(bag(6, 4, stack("boar-tusk", 0, 0)), { x: 0, y: 1 }),
      { from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, turned: true });
    assert.deepEqual(turnInPlace(bag(6, 4, stack("boar-tusk", 0, 0, 1, true)), { x: 1, y: 0 }),
      { from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, turned: false });
    assert.equal(turnInPlace(bag(6, 4, stack("boar-tusk", 0, 0), stack("boar-meat", 1, 0)), { x: 0, y: 0 }), null);
    assert.equal(turnInPlace(BAG, { x: 1, y: 3 }), null, "nothing there");
  });

  test("square items don't turn", () => {
    assert.equal(turnInPlace(BAG, { x: 2, y: 0 }), null);
    const hide = dragFrom(2, 0);
    assert.deepEqual(turnKey(hide, BAG).mouse, hide);
  });
});

describe("use", () => {
  test("uses the selected stack, if it can be used", () => {
    assert.deepEqual(itemToUse(click(NO_MOUSE, 0, 0), BAG, false), { x: 0, y: 0 });
    assert.equal(itemToUse(click(NO_MOUSE, 2, 0), BAG, false), null, "a hide can't be used");
    assert.equal(itemToUse(NO_MOUSE, BAG, false), null, "nothing selected");
  });

  test("food does nothing at full HP", () => {
    assert.equal(itemToUse(click(NO_MOUSE, 0, 0), BAG, true), null);
  });

  test("not while dragging", () => {
    assert.equal(itemToUse(dragFrom(0, 0), BAG, false), null);
  });

  test("a double click selects the stack under it first", () => {
    const m = doubleClick(click(NO_MOUSE, 5, 0), BAG, over(0, 0));
    assert.deepEqual(m.selected, { x: 0, y: 0 });
    assert.deepEqual(itemToUse(m, BAG, false), { x: 0, y: 0 });
  });

  test("a double click on empty space selects nothing", () => {
    assert.equal(doubleClick(click(NO_MOUSE, 0, 0), BAG, over(1, 3)).selected, null);
  });
});

describe("when the bag changes underneath", () => {
  test("a selection whose stack is gone (eaten, lost in a fight) is dropped; one still there stays", () => {
    const meat = click(NO_MOUSE, 0, 0);
    assert.equal(keepUp(meat, bag(6, 4, stack("boar-hide", 2, 0))).selected, null);
    assert.equal(keepUp(meat, bag(6, 4, stack("boar-meat", 0, 0, 2))), meat);
  });

  test("a dragged stack that's gone is let go", () => {
    assert.equal(keepUp(dragFrom(0, 0), bag(6, 4, stack("boar-hide", 2, 0))).drag, null);
  });

  test("nothing to keep up: the same state back", () => {
    const m = dragFrom(5, 0);
    assert.equal(keepUp(m, BAG), m);
    assert.equal(keepUp(NO_MOUSE, bag(0, 0)), NO_MOUSE);
  });
});
