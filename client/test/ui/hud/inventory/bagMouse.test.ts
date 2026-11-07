import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  AVERAGE_STAT, CLOTH, emptyCloth, emptyEquipment, ITEMS, NO_PILE, packFor, WEAPONS, type BagItem, type Equipment,
  type Gear, type ItemId, type Slot, type Spot,
} from "@infinite-tower/shared";
import {
  canDrop, cancel, DRAG_START_PX, doubleClick, hoveredStack, itemToUse, keepUp, landing, NO_MOUSE, pointerDown,
  pointerMove, pointerUp, rightPress, selectedStack, tick, TOOLTIP_DELAY_MS, turnInPlace, turnKey,
  type BagMouse, type Pointer,
} from "../../../../src/ui/hud/inventory/bagMouse.js";
import { armed } from "../../../fixtures/armed.js";

const STRENGTH = AVERAGE_STAT;
const NOTHING_WORN: Equipment = emptyEquipment();
const bag = (cols: number, rows: number, ...items: BagItem[]): Gear =>
  ({ bag: { cols, rows, items }, pack: packFor(null), cloth: emptyCloth(), pile: NO_PILE, equipment: NOTHING_WORN });
const stack = (item: ItemId, x: number, y: number, count = 1, turned = false): BagItem =>
  ({ item, count, x, y, turned });
const at = (x: number, y: number): Spot => ({ in: "bag", x, y });
const onCloth = (x: number, y: number): Spot => ({ in: "cloth", x, y });
const onPile = (x: number, y: number): Spot => ({ in: "pile", x, y });
const inPack = (x: number, y: number): Spot => ({ in: "pack", x, y });
const slot = (name: Slot): Spot => ({ in: "slot", slot: name });

/** A 6x4 bag: meat x3 at 0,0; a hide at 2,0 (2x2); a tusk standing at 5,0 (1x2). */
const BAG = bag(6, 4, stack("boar-meat", 0, 0, 3), stack("boar-hide", 2, 0), stack("boar-tusk", 5, 0));

const CELL_PX = 10;
const over = (x: number, y: number, dx = 0, dy = 0, g: Gear = BAG): Pointer => ({
  over: x >= 0 && y >= 0 && x < g.bag.cols && y < g.bag.rows ? at(x, y) : null,
  x: (x + 0.5) * CELL_PX + dx, y: (y + 0.5) * CELL_PX + dy,
});
const overSpot = (spot: Spot, dx = 0): Pointer => ({ over: spot, x: 100 + dx, y: 5 });
const FAR = DRAG_START_PX + 1;

/** Press on a cell and move just far enough to start dragging. */
function dragFrom(x: number, y: number, g: Gear = BAG, m: BagMouse = NO_MOUSE): BagMouse {
  return pointerMove(pointerDown(m, g, over(x, y, 0, 0, g)), g, over(x, y, FAR, 0, g), 0);
}
/** Press and let go without moving: a click. */
const click = (m: BagMouse, x: number, y: number, g: Gear = BAG) =>
  pointerUp(pointerDown(m, g, over(x, y, 0, 0, g)), g, over(x, y, 0, 0, g), 0, STRENGTH).mouse;

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
    assert.deepEqual(click(NO_MOUSE, 3, 1).selected, at(2, 0));
    assert.equal(selectedStack(click(NO_MOUSE, 3, 1), BAG)?.item, "boar-hide");
  });

  test("a click on the selected stack, or on empty space, deselects", () => {
    const hide = click(NO_MOUSE, 2, 0);
    assert.equal(click(hide, 3, 1).selected, null);
    assert.equal(click(hide, 1, 3).selected, null);
  });

  test("a click on another stack selects that one instead", () => {
    assert.deepEqual(click(click(NO_MOUSE, 2, 0), 5, 1).selected, at(5, 0));
  });

  test("a press that moves a little (under the drag threshold) is still a click", () => {
    const pressed = pointerDown(NO_MOUSE, BAG, over(0, 0));
    const wobbled = pointerMove(pressed, BAG, over(0, 0, DRAG_START_PX - 1, 0), 0);
    assert.equal(wobbled.drag, null);
    assert.deepEqual(pointerUp(wobbled, BAG, over(0, 0, DRAG_START_PX - 1, 0), 0, STRENGTH).mouse.selected, at(0, 0));
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
    assert.deepEqual(m.drag, { from: at(2, 0), item: "boar-hide", turned: false, grip: { x: 1, y: 1 } });
  });

  test("dragging selects the stack, and nothing is hovered meanwhile", () => {
    const m = dragFrom(5, 0, BAG, click(NO_MOUSE, 0, 0));
    assert.deepEqual(m.selected, at(5, 0));
    assert.equal(hoveredStack(m, BAG), null);
  });

  test("a press on empty space never drags", () => {
    const m = pointerMove(pointerDown(NO_MOUSE, BAG, over(1, 3)), BAG, over(3, 3), 0);
    assert.equal(m.drag, null);
  });

  test("it would land under the pointer, offset by where it was held, kept inside the bag", () => {
    const hide = dragFrom(3, 1);
    assert.deepEqual(landing(pointerMove(hide, BAG, over(1, 3), 0), BAG), at(0, 2));
    assert.deepEqual(landing(pointerMove(hide, BAG, over(0, 0), 0), BAG), at(0, 0), "held by its far corner");
    const tusk = dragFrom(5, 0);
    assert.deepEqual(landing(pointerMove(tusk, BAG, over(1, 3), 0), BAG), at(1, 2), "can't stick out below");
  });

  test("off the grid it has nowhere to land, so it doesn't fit", () => {
    const m = pointerMove(dragFrom(0, 0), BAG, over(-2, 1), 0);
    assert.equal(landing(m, BAG), null);
    assert.equal(canDrop(m, BAG, STRENGTH), false);
  });

  test("fits on free cells and where it came from; not over another item", () => {
    const tusk = dragFrom(5, 0);
    assert.equal(canDrop(pointerMove(tusk, BAG, over(0, 2), 0), BAG, STRENGTH), true);
    assert.equal(canDrop(pointerMove(tusk, BAG, over(5, 0), 0), BAG, STRENGTH), true);
    assert.equal(canDrop(pointerMove(tusk, BAG, over(3, 0), 0), BAG, STRENGTH), false);
  });

  test("dropped on free cells: a move for the server, and the moved stack stays selected", () => {
    const m = pointerMove(dragFrom(5, 0), BAG, over(0, 2), 0);
    const { mouse, move } = pointerUp(m, BAG, over(0, 2), 0, STRENGTH);
    assert.deepEqual(move, { from: at(5, 0), to: at(0, 2), turned: false });
    assert.equal(mouse.drag, null);
    assert.deepEqual(mouse.selected, at(0, 2));
  });

  test("dropped over another item: no move, it snaps back and stays selected", () => {
    const m = pointerMove(dragFrom(5, 0), BAG, over(3, 0), 0);
    const { mouse, move } = pointerUp(m, BAG, over(3, 0), 0, STRENGTH);
    assert.equal(move, null);
    assert.equal(mouse.drag, null);
    assert.deepEqual(mouse.selected, at(5, 0));
  });

  test("dropped off the grid: no move, it snaps back", () => {
    const m = pointerMove(dragFrom(0, 0), BAG, over(9, 9), 0);
    const { mouse, move } = pointerUp(m, BAG, over(9, 9), 0, STRENGTH);
    assert.equal(move, null);
    assert.equal(mouse.drag, null);
  });

  test("dropped where it came from: nothing to send", () => {
    const { mouse, move } = pointerUp(pointerMove(dragFrom(0, 0), BAG, over(0, 0), 0), BAG, over(0, 0), 0, STRENGTH);
    assert.equal(move, null);
    assert.deepEqual(mouse.selected, at(0, 0));
  });

  test("onto a stack of the same item that has room: a move (the server tops it up)", () => {
    const two = bag(6, 4, stack("boar-meat", 0, 0, 3), stack("boar-meat", 1, 0, 1));
    const m = pointerMove(dragFrom(1, 0, two), two, over(0, 0, 0, 0, two), 0);
    assert.equal(canDrop(m, two, STRENGTH), true);
    const { move } = pointerUp(m, two, over(0, 0, 0, 0, two), 0, STRENGTH);
    assert.deepEqual(move, { from: at(1, 0), to: at(0, 0), turned: false });
  });

  test("onto a full stack: it doesn't fit", () => {
    const full = ITEMS["boar-meat"].stackSize;
    const two = bag(6, 4, stack("boar-meat", 0, 0, full), stack("boar-meat", 1, 0, 1));
    assert.equal(canDrop(pointerMove(dragFrom(1, 0, two), two, over(0, 0, 0, 0, two), 0), two, STRENGTH), false);
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
      assert.deepEqual(mouse.drag, { from: at(5, 0), item: "boar-tusk", turned: true, grip: { x: 1, y: 0 } });
    }
  });

  test("a turn while dragging changes where it fits", () => {
    // The tusk held by its lower cell, pointing at 1,3: standing it covers 1,2-1,3; lying it covers 0,3-1,3.
    const m = pointerMove(dragFrom(5, 1), BAG, over(1, 3), 0);
    const blocked = bag(6, 4, ...BAG.bag.items, stack("boar-meat", 0, 3));
    assert.equal(canDrop(m, blocked, STRENGTH), true);
    assert.equal(canDrop(turnKey(m, blocked).mouse, blocked, STRENGTH), false);
  });

  test("R with nothing dragged turns the selected item in place, if it fits turned", () => {
    const tusk = click(NO_MOUSE, 5, 0);
    const lone = bag(6, 4, stack("boar-tusk", 4, 0));
    const { move } = turnKey(click(NO_MOUSE, 4, 0, lone), lone);
    assert.deepEqual(move, { from: at(4, 0), to: at(4, 0), turned: true });
    assert.equal(turnKey(tusk, BAG).move, null, "lying across from 5,0 it would stick out of the bag");
    assert.equal(turnKey(NO_MOUSE, BAG).move, null, "nothing selected");
  });

  test("a right press with nothing dragged turns the item under the pointer in place, selected or not", () => {
    const lone = bag(6, 4, stack("boar-tusk", 2, 1), stack("boar-meat", 0, 0));
    const m = pointerMove(click(NO_MOUSE, 0, 0, lone), lone, over(2, 2, 0, 0, lone), 0);
    const { mouse, move } = rightPress(m, lone);
    assert.deepEqual(move, { from: at(2, 1), to: at(2, 1), turned: true });
    assert.deepEqual(mouse.selected, at(0, 0));
    assert.equal(rightPress(pointerMove(NO_MOUSE, lone, over(4, 3, 0, 0, lone), 0), lone).move, null, "empty cell");
  });

  test("turning in place: a move to the same top-left, turned flipped, only where the turned shape fits", () => {
    assert.deepEqual(turnInPlace(bag(6, 4, stack("boar-tusk", 0, 0)), at(0, 1)),
      { from: at(0, 0), to: at(0, 0), turned: true });
    assert.deepEqual(turnInPlace(bag(6, 4, stack("boar-tusk", 0, 0, 1, true)), at(1, 0)),
      { from: at(0, 0), to: at(0, 0), turned: false });
    assert.equal(turnInPlace(bag(6, 4, stack("boar-tusk", 0, 0), stack("boar-meat", 1, 0)), at(0, 0)), null);
    assert.equal(turnInPlace(BAG, at(1, 3)), null, "nothing there");
  });

  test("square items don't turn", () => {
    assert.equal(turnInPlace(BAG, at(2, 0)), null);
    const hide = dragFrom(2, 0);
    assert.deepEqual(turnKey(hide, BAG).mouse, hide);
  });
});

describe("use", () => {
  test("uses the selected stack, if it can be used", () => {
    assert.deepEqual(itemToUse(click(NO_MOUSE, 0, 0), BAG, false), at(0, 0));
    assert.equal(itemToUse(click(NO_MOUSE, 2, 0), BAG, false), null, "a hide can't be used");
    assert.equal(itemToUse(NO_MOUSE, BAG, false), null, "nothing selected");
  });

  test("food does nothing at full HP; essence is absorbed all the same", () => {
    assert.equal(itemToUse(click(NO_MOUSE, 0, 0), BAG, true), null);
    const withEssence = bag(6, 4, stack("boar-essence", 0, 0));
    assert.deepEqual(itemToUse(click(NO_MOUSE, 0, 0, withEssence), withEssence, true), at(0, 0));
  });

  test("not while dragging", () => {
    assert.equal(itemToUse(dragFrom(0, 0), BAG, false), null);
  });

  test("a double click selects the stack under it first", () => {
    const m = doubleClick(click(NO_MOUSE, 5, 0), BAG, over(0, 0));
    assert.deepEqual(m.selected, at(0, 0));
    assert.deepEqual(itemToUse(m, BAG, false), at(0, 0));
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

describe("the cloth and the equipment", () => {
  const SWORD_BAG = bag(6, 4, stack("sword", 0, 0), stack("boar-meat", 2, 0, 2));
  const fromBag = (x: number, y: number, g: Gear) => dragFrom(x, y, g);

  test("the cloth's cells are hovered, selected and dragged from like the bag's", () => {
    const g: Gear = { ...BAG, cloth: { ...emptyCloth(), items: [stack("boar-hide", 1, 1)] } };
    assert.equal(hoveredStack(pointerMove(NO_MOUSE, g, overSpot(onCloth(2, 2)), 0), g)?.item, "boar-hide");
    const pressed = pointerDown(NO_MOUSE, g, overSpot(onCloth(2, 2)));
    const dragging = pointerMove(pressed, g, overSpot(onCloth(2, 2), FAR), 0);
    assert.deepEqual(dragging.drag, { from: onCloth(1, 1), item: "boar-hide", turned: false, grip: { x: 1, y: 1 } });
  });

  test("dragged from the bag onto the cloth: a move there, kept inside the cloth", () => {
    const m = pointerMove(fromBag(5, 1, BAG), BAG, overSpot(onCloth(3, CLOTH.rows - 1)), 0);
    assert.deepEqual(landing(m, BAG), onCloth(3, CLOTH.rows - 2));
    const { mouse, move } = pointerUp(m, BAG, overSpot(onCloth(3, CLOTH.rows - 1)), 0, STRENGTH);
    assert.deepEqual(move, { from: at(5, 0), to: onCloth(3, CLOTH.rows - 2), turned: false });
    assert.deepEqual(mouse.selected, onCloth(3, CLOTH.rows - 2));
  });

  test("the sword dragged onto an empty hand: a move into that slot", () => {
    const m = pointerMove(fromBag(0, 1, SWORD_BAG), SWORD_BAG, overSpot(slot("leftHand")), 0);
    assert.deepEqual(landing(m, SWORD_BAG), slot("leftHand"));
    assert.equal(canDrop(m, SWORD_BAG, STRENGTH), true);
    assert.deepEqual(pointerUp(m, SWORD_BAG, overSpot(slot("leftHand")), 0, STRENGTH).move,
      { from: at(0, 0), to: slot("leftHand"), turned: false });
  });

  test("a weapon too heavy for the strength: no move onto a hand, and it says which", () => {
    const g = bag(6, 4, stack("greatsword", 0, 0));
    const m = pointerMove(fromBag(0, 1, g), g, overSpot(slot("rightHand")), 0);
    const need = WEAPONS.greatsword.minStrength;
    assert.equal(canDrop(m, g, need - 1), false);
    const weak = pointerUp(m, g, overSpot(slot("rightHand")), 0, need - 1);
    assert.equal(weak.move, null);
    assert.equal(weak.tooWeak, "greatsword");
    const strong = pointerUp(m, g, overSpot(slot("rightHand")), 0, need);
    assert.equal(strong.tooWeak, null);
    assert.deepEqual(strong.move, { from: at(0, 0), to: slot("rightHand"), turned: false });
  });

  test("not onto a slot that doesn't take it, nor meat into a hand", () => {
    const sword = pointerMove(fromBag(0, 1, SWORD_BAG), SWORD_BAG, overSpot(slot("head")), 0);
    assert.equal(canDrop(sword, SWORD_BAG, STRENGTH), false);
    const meat = pointerMove(fromBag(2, 0, SWORD_BAG), SWORD_BAG, overSpot(slot("rightHand")), 0);
    assert.equal(canDrop(meat, SWORD_BAG, STRENGTH), false);
    assert.equal(pointerUp(meat, SWORD_BAG, overSpot(slot("rightHand")), 0, STRENGTH).move, null);
  });

  test("a slot's item is hovered and selected by its slot, and dragged held by its first cell", () => {
    const g: Gear = { ...BAG, equipment: armed() };
    assert.equal(hoveredStack(pointerMove(NO_MOUSE, g, overSpot(slot("rightHand")), 0), g)?.item, "sword");
    const clicked =
      pointerUp(pointerDown(NO_MOUSE, g, overSpot(slot("rightHand"))), g, overSpot(slot("rightHand")), 0, STRENGTH);
    assert.deepEqual(clicked.mouse.selected, slot("rightHand"));
    assert.equal(selectedStack(clicked.mouse, g)?.item, "sword");
    const press = pointerDown(NO_MOUSE, g, overSpot(slot("rightHand")));
    const dragging = pointerMove(press, g, overSpot(slot("rightHand"), FAR), 0);
    assert.deepEqual(dragging.drag, { from: slot("rightHand"), item: "sword", turned: false, grip: { x: 0, y: 0 } });
  });

  test("taken off a hand into the bag, or swapped to the other hand", () => {
    const g: Gear = { ...bag(6, 4), equipment: armed() };
    const press = pointerDown(NO_MOUSE, g, overSpot(slot("rightHand")));
    const dragging = pointerMove(press, g, overSpot(slot("rightHand"), FAR), 0);
    assert.deepEqual(
      pointerUp(pointerMove(dragging, g, over(3, 0, 0, 0, g), 0), g, over(3, 0, 0, 0, g), 0, STRENGTH).move,
      { from: slot("rightHand"), to: at(3, 0), turned: false });
    assert.deepEqual(pointerUp(dragging, g, overSpot(slot("leftHand")), 0, STRENGTH).move,
      { from: slot("rightHand"), to: slot("leftHand"), turned: false });
  });

  test("worn things don't turn in place, nor get used", () => {
    const g: Gear = { ...BAG, equipment: armed() };
    assert.equal(turnInPlace(g, slot("rightHand")), null);
    const clicked =
      pointerUp(pointerDown(NO_MOUSE, g, overSpot(slot("rightHand"))), g, overSpot(slot("rightHand")), 0, STRENGTH);
    assert.equal(itemToUse(clicked.mouse, g, false), null);
  });

  test("meat on the cloth can be eaten from there", () => {
    const g: Gear = { ...BAG, cloth: { ...emptyCloth(), items: [stack("boar-meat", 0, 0)] } };
    const clicked =
      pointerUp(pointerDown(NO_MOUSE, g, overSpot(onCloth(0, 0))), g, overSpot(onCloth(0, 0)), 0, STRENGTH);
    assert.deepEqual(itemToUse(clicked.mouse, g, false), onCloth(0, 0));
  });

  test("a selected hand that's emptied (by the server's answer) is let go", () => {
    const g: Gear = { ...BAG, equipment: armed() };
    const clicked =
      pointerUp(pointerDown(NO_MOUSE, g, overSpot(slot("rightHand"))), g, overSpot(slot("rightHand")), 0, STRENGTH);
    assert.equal(keepUp(clicked.mouse, { ...g, equipment: NOTHING_WORN }).selected, null);
  });
});

describe("the backpack", () => {
  const WORN: Gear = {
    ...BAG, equipment: { ...NOTHING_WORN, back: "canvas-backpack" },
    pack: { ...packFor("canvas-backpack"), items: [stack("boar-meat", 1, 1, 2)] },
  };
  const fromPack = (x: number, y: number, g: Gear = WORN) =>
    pointerMove(pointerDown(NO_MOUSE, g, overSpot(inPack(x, y))), g, overSpot(inPack(x, y), FAR), 0);

  test("dragged from its grid into the bag, and from the bag into it: moves between the two", () => {
    const out = pointerMove(fromPack(1, 1), WORN, over(1, 2), 0);
    assert.deepEqual(pointerUp(out, WORN, over(1, 2), 0, STRENGTH).move,
      { from: inPack(1, 1), to: at(1, 2), turned: false });
    const into = pointerMove(dragFrom(5, 1, WORN), WORN, overSpot(inPack(3, 3)), 0);
    assert.deepEqual(landing(into, WORN), inPack(3, 2));
    assert.deepEqual(pointerUp(into, WORN, overSpot(inPack(3, 3)), 0, STRENGTH).move,
      { from: at(5, 0), to: inPack(3, 2), turned: false });
  });

  test("what's in it is used from there", () => {
    const clicked =
      pointerUp(pointerDown(NO_MOUSE, WORN, overSpot(inPack(1, 1))), WORN, overSpot(inPack(1, 1)), 0, STRENGTH);
    assert.deepEqual(itemToUse(clicked.mouse, WORN, false), inPack(1, 1));
  });

  test("it can't be taken off with things in it", () => {
    const press = pointerDown(NO_MOUSE, WORN, overSpot(slot("back")));
    const dragging = pointerMove(press, WORN, overSpot(slot("back"), FAR), 0);
    const onto = pointerMove(dragging, WORN, over(1, 3), 0);
    assert.equal(canDrop(onto, WORN, STRENGTH), false);
  });
});

describe("an open pile", () => {
  const PILED: Gear = {
    ...bag(6, 4), pile: { cols: 4, rows: 2, items: [stack("boar-tusk", 0, 0), stack("boar-meat", 1, 0)] },
  };
  const fromPile = (x: number, y: number, g: Gear = PILED) =>
    pointerMove(pointerDown(NO_MOUSE, g, overSpot(onPile(x, y))), g, overSpot(onPile(x, y), FAR), 0);

  test("its items are dragged into the bag: a move from the pile", () => {
    const m = pointerMove(fromPile(0, 1), PILED, over(2, 1, 0, 0, PILED), 0);
    assert.equal(canDrop(m, PILED, STRENGTH), true);
    const { move } = pointerUp(m, PILED, over(2, 1, 0, 0, PILED), 0, STRENGTH);
    assert.deepEqual(move, { from: onPile(0, 0), to: at(2, 0), turned: false });
  });

  test("nothing is dropped onto it, from the bag or moved about on it", () => {
    const g: Gear = { ...PILED, bag: { ...PILED.bag, items: [stack("boar-hide", 0, 0)] } };
    const fromBag = pointerMove(dragFrom(0, 0, g), g, overSpot(onPile(2, 0)), 0);
    assert.equal(canDrop(fromBag, g, STRENGTH), false);
    assert.equal(pointerUp(fromBag, g, overSpot(onPile(2, 0)), 0, STRENGTH).move, null);
    const within = pointerMove(fromPile(1, 0), PILED, overSpot(onPile(3, 1)), 0);
    assert.equal(canDrop(within, PILED, STRENGTH), false);
  });

  test("its meat isn't eaten from it: it's taken into the bag first", () => {
    const clicked =
      pointerUp(pointerDown(NO_MOUSE, PILED, overSpot(onPile(1, 0))), PILED, overSpot(onPile(1, 0)), 0, STRENGTH);
    assert.equal(selectedStack(clicked.mouse, PILED)?.item, "boar-meat");
    assert.equal(itemToUse(clicked.mouse, PILED, false), null);
  });
});
