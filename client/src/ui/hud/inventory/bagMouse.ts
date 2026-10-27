/**
 * The bag screen's mouse as plain data: hovered, selected and dragged, kept apart. Whether a move is allowed is the
 * shared bag rules' call; a drop here only says what to ask the server for.
 */
import {
  footprint, itemAt, itemDef, moveItem, type Bag, type BagItem, type Cell, type ItemId,
} from "@infinite-tower/shared";

/** How far a press on an item moves before it's a drag rather than a click. */
export const DRAG_START_PX = 4;
/** How long the pointer rests on an item before its tooltip shows. */
export const TOOLTIP_DELAY_MS = 600;

export interface Pointer {
  /** The cell under it; off the grid, the one it would be past the edge. */
  cell: Cell;
  inside: boolean;
  /** Pixels from the grid's top-left. */
  x: number;
  y: number;
}

interface Drag {
  /** The stack's top-left when the drag started: what the server knows it by. */
  from: Cell;
  item: ItemId;
  turned: boolean;
  /** The item's cell under the pointer, from its top-left (as it lies now). */
  grip: Cell;
}

interface Hover {
  /** The hovered stack's top-left. */
  stack: Cell;
  /** When the pointer last moved over it, while the tooltip waits. */
  sinceMs: number;
  tooltip: boolean;
}

export interface BagMouse {
  /** null once the pointer has left the grid. */
  pointer: Pointer | null;
  /** null while dragging. */
  hover: Hover | null;
  /** The selected stack's top-left. */
  selected: Cell | null;
  /** The button is down but hasn't moved far enough to drag: let go, it's a click. `stack` is the one pressed. */
  press: { at: Pointer; stack: Cell | null } | null;
  drag: Drag | null;
}

/** What to send the server (`moveItem`). */
export interface Move {
  from: Cell;
  to: Cell;
  turned: boolean;
}

export const NO_MOUSE: BagMouse = { pointer: null, hover: null, selected: null, press: null, drag: null };

const same = (a: Cell | null, b: Cell | null) => a === b || (!!a && !!b && a.x === b.x && a.y === b.y);
const topLeft = (s: BagItem): Cell => ({ x: s.x, y: s.y });
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const isSquare = (item: ItemId) => footprint(item, false).cols === footprint(item, false).rows;

/** The stack covering the pointer's cell. */
const under = (bag: Bag, p: Pointer | null): BagItem | null => (p?.inside && bag.items[itemAt(bag, p.cell)]) || null;

/** The stack whose top-left is `cell`. */
function stackAt(bag: Bag, cell: Cell | null): BagItem | null {
  const s = cell && bag.items[itemAt(bag, cell)];
  return s && same(topLeft(s), cell) ? s : null;
}

/** The pointer is now at `p`: the hover follows it, and the tooltip's wait starts over unless it's already up. */
function point(m: BagMouse, bag: Bag, p: Pointer | null, nowMs: number): BagMouse {
  const s = m.drag ? null : under(bag, p);
  const kept = s && m.hover?.tooltip && same(m.hover.stack, topLeft(s)) ? m.hover : null;
  const hover = kept ?? (s && { stack: topLeft(s), sinceMs: nowMs, tooltip: false });
  return { ...m, pointer: p, hover };
}

/** The pointer moved (`p`), or left the grid (null). A press on an item that moves far enough starts a drag. */
export function pointerMove(m: BagMouse, bag: Bag, p: Pointer | null, nowMs: number): BagMouse {
  const pressed = stackAt(bag, m.press?.stack ?? null);
  if (m.press && pressed && p && Math.hypot(p.x - m.press.at.x, p.y - m.press.at.y) > DRAG_START_PX) {
    const { cell } = m.press.at;
    const grip = { x: cell.x - pressed.x, y: cell.y - pressed.y };
    const drag = { from: topLeft(pressed), item: pressed.item, turned: pressed.turned, grip };
    return point({ ...m, press: null, drag, selected: drag.from }, bag, p, nowMs);
  }
  return point(m, bag, p, nowMs);
}

/** Time passing: the tooltip shows once the pointer has rested on a stack for TOOLTIP_DELAY_MS. */
export function tick(m: BagMouse, nowMs: number): BagMouse {
  const { hover } = m;
  if (!hover || hover.tooltip || nowMs - hover.sinceMs < TOOLTIP_DELAY_MS) return m;
  return { ...m, hover: { ...hover, tooltip: true } };
}

/** The main button goes down: a click or the start of a drag, depending on what follows. */
export function pointerDown(m: BagMouse, bag: Bag, p: Pointer): BagMouse {
  const s = under(bag, p);
  return { ...m, pointer: p, press: { at: p, stack: s && topLeft(s) } };
}

/**
 * The main button comes up. Ending a drag, the item goes down where it would land if it fits there (`move`), or
 * else back where it was; either way it stays selected. Ending a click, it selects the stack clicked, or deselects
 * (clicking the selected one again, or empty space).
 */
export function pointerUp(m: BagMouse, bag: Bag, p: Pointer, nowMs: number): { mouse: BagMouse; move: Move | null } {
  const at = { ...m, pointer: p, press: null, drag: null };
  if (m.drag) {
    const to = landing({ ...m, pointer: p }, bag);
    const fits = !!to && canDrop({ ...m, pointer: p }, bag) && !isWhereItWas(m.drag, to, bag);
    const move = fits ? { from: m.drag.from, to: to!, turned: m.drag.turned } : null;
    const after = move ? moveItem(bag, move.from, move.to, move.turned) ?? bag : bag;
    return { mouse: point({ ...at, selected: move?.to ?? m.drag.from }, after, p, nowMs), move };
  }
  const clicked = m.press && (same(m.press.stack, m.selected) ? null : m.press.stack);
  return { mouse: point({ ...at, selected: m.press ? clicked : m.selected }, bag, p, nowMs), move: null };
}

/** Where the dragged item would land: its top-left under the pointer, kept inside the bag. null off the grid. */
export function landing(m: BagMouse, bag: Bag): Cell | null {
  const { drag, pointer } = m;
  if (!drag || !pointer?.inside) return null;
  const { cols, rows } = footprint(drag.item, drag.turned);
  return {
    x: clamp(pointer.cell.x - drag.grip.x, 0, Math.max(0, bag.cols - cols)),
    y: clamp(pointer.cell.y - drag.grip.y, 0, Math.max(0, bag.rows - rows)),
  };
}

const isWhereItWas = (drag: Drag, to: Cell, bag: Bag) =>
  same(drag.from, to) && stackAt(bag, drag.from)?.turned === drag.turned;

/** Whether the dragged item can go down where it would land. */
export function canDrop(m: BagMouse, bag: Bag): boolean {
  const to = landing(m, bag);
  if (!m.drag || !to) return false;
  return isWhereItWas(m.drag, to, bag) || moveItem(bag, m.drag.from, to, m.drag.turned) !== null;
}

/** Drop the drag (and a press) without moving anything: the item stays where it was. */
export const cancel = (m: BagMouse): BagMouse => (m.drag || m.press ? { ...m, drag: null, press: null } : m);

/**
 * Turning the stack covering `cell` where it lies: a move to the same top-left, turned the other way. null if
 * there's nothing there, it's square (it would look the same), or turned it wouldn't fit.
 */
export function turnInPlace(bag: Bag, cell: Cell): Move | null {
  const s = bag.items[itemAt(bag, cell)];
  if (!s || isSquare(s.item)) return null;
  const at = topLeft(s);
  return moveItem(bag, at, at, !s.turned) ? { from: at, to: at, turned: !s.turned } : null;
}

type Turned = { mouse: BagMouse; move: Move | null };

/** The turn key: turns what's dragged (held by the same cell of it), or else the selected item in place. */
export function turnKey(m: BagMouse, bag: Bag): Turned {
  const { drag } = m;
  if (!drag) return { mouse: m, move: m.selected && turnInPlace(bag, m.selected) };
  if (isSquare(drag.item)) return { mouse: m, move: null };
  const turned = { ...drag, turned: !drag.turned, grip: { x: drag.grip.y, y: drag.grip.x } };
  return { mouse: { ...m, drag: turned }, move: null };
}

/** A right press: turns what's dragged, or else the item under the pointer in place (selected or not). */
export function rightPress(m: BagMouse, bag: Bag): Turned {
  if (m.drag) return turnKey(m, bag);
  const s = under(bag, m.pointer);
  return { mouse: m, move: s && turnInPlace(bag, topLeft(s)) };
}

/** Whether using it would do anything: it has a use, and food isn't wasted at full HP (the server refuses). */
function canUse(stack: BagItem, fullHp: boolean): boolean {
  const def = itemDef(stack.item);
  return !!def.verb && !(def.healHp && fullHp);
}

/** What Enter, a double click or the Use button use: the selected stack, if it can be used. Not mid-drag. */
export function itemToUse(m: BagMouse, bag: Bag, fullHp: boolean): Cell | null {
  const s = m.drag ? null : stackAt(bag, m.selected);
  return s && canUse(s, fullHp) ? topLeft(s) : null;
}

/** A double click selects what's under it (nothing, on empty space); then that's used (`itemToUse`). */
export function doubleClick(m: BagMouse, bag: Bag, p: Pointer): BagMouse {
  const s = under(bag, p);
  return { ...m, pointer: p, selected: s && topLeft(s) };
}

export const selectedStack = (m: BagMouse, bag: Bag): BagItem | null => stackAt(bag, m.selected);
export const hoveredStack = (m: BagMouse, bag: Bag): BagItem | null =>
  m.drag ? null : stackAt(bag, m.hover?.stack ?? null);

/**
 * The mouse after the bag changed (the server's word on it, a meal eaten, a fight lost): whatever was selected,
 * dragged, pressed or hovered that's no longer there is let go.
 */
export function keepUp(m: BagMouse, bag: Bag): BagMouse {
  const there = (cell: Cell | null | undefined) => !!cell && stackAt(bag, cell) !== null;
  const selected = there(m.selected) ? m.selected : null;
  const drag = m.drag && stackAt(bag, m.drag.from)?.item === m.drag.item ? m.drag : null;
  const press = m.press?.stack && !there(m.press.stack) ? null : m.press;
  const hover = there(m.hover?.stack) ? m.hover : null;
  if (selected === m.selected && drag === m.drag && press === m.press && hover === m.hover) return m;
  return { ...m, selected, drag, press, hover };
}
