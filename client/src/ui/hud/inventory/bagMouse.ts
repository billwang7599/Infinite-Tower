/**
 * The bag screen's mouse as plain data, over the bag, the backpack, the cloth, an open pile and the equipment slots:
 * hovered, selected and dragged, kept apart. Whether a move is allowed is the shared gear rules' call; a drop here only
 * says what to ask the server for.
 */
import {
  displacedBy, footprint, itemDef, moveGear, moveItem, stackIn, unwieldableHand, type BagItem, type Cell, type Gear,
  type GearMove, type GridSpot, type ItemId, type Spot, type UseSpot, type WeaponId,
} from "@infinite-tower/shared";

/** How far a press on an item moves before it's a drag rather than a click. */
export const DRAG_START_PX = 4;
/** How long the pointer rests on an item before its tooltip shows. */
export const TOOLTIP_DELAY_MS = 600;

export interface Pointer {
  over: Spot | null;
  x: number;
  y: number;
}

interface Drag {
  from: Spot;
  item: ItemId;
  turned: boolean;
  /** The item's cell under the pointer, from its top-left (as it lies now). */
  grip: Cell;
}

interface Hover {
  stack: Spot;
  /** When the pointer last moved over it, while the tooltip waits. */
  sinceMs: number;
  tooltip: boolean;
}

export interface BagMouse {
  pointer: Pointer | null;
  /** null while dragging. */
  hover: Hover | null;
  selected: Spot | null;
  /** The button is down but hasn't moved far enough to drag: let go, it's a click. `stack` is the one pressed. */
  press: { at: Pointer; stack: Spot | null } | null;
  drag: Drag | null;
}

export const NO_MOUSE: BagMouse = { pointer: null, hover: null, selected: null, press: null, drag: null };

export function same(a: Spot | null, b: Spot | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.in !== b.in) return false;
  return a.in === "slot" ? a.slot === (b as typeof a).slot : a.x === (b as GridSpot).x && a.y === (b as GridSpot).y;
}
const keyOf = (spot: Spot, s: BagItem): Spot => spot.in === "slot" ? spot : { in: spot.in, x: s.x, y: s.y };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const isSquare = (item: ItemId) => footprint(item, false).cols === footprint(item, false).rows;

function under(gear: Gear, p: Pointer | null): Spot | null {
  const s = p?.over && stackIn(gear, p.over);
  return s ? keyOf(p.over!, s) : null;
}

function stackAt(gear: Gear, spot: Spot | null): BagItem | null {
  const s = spot && stackIn(gear, spot);
  return s && same(keyOf(spot, s), spot) ? s : null;
}

/** The pointer is now at `p`: the hover follows it, and the tooltip's wait starts over unless it's already up. */
function point(m: BagMouse, gear: Gear, p: Pointer | null, nowMs: number): BagMouse {
  const s = m.drag ? null : under(gear, p);
  const kept = s && m.hover?.tooltip && same(m.hover.stack, s) ? m.hover : null;
  const hover = kept ?? (s && { stack: s, sinceMs: nowMs, tooltip: false });
  return { ...m, pointer: p, hover };
}

export function pointerMove(m: BagMouse, gear: Gear, p: Pointer | null, nowMs: number): BagMouse {
  const from = m.press?.stack ?? null;
  const pressed = stackAt(gear, from);
  if (m.press && from && pressed && p && Math.hypot(p.x - m.press.at.x, p.y - m.press.at.y) > DRAG_START_PX) {
    const on = m.press.at.over;
    const grip = on && on.in !== "slot" ? { x: on.x - pressed.x, y: on.y - pressed.y } : { x: 0, y: 0 };
    const drag = { from, item: pressed.item, turned: pressed.turned, grip };
    return point({ ...m, press: null, drag, selected: from }, gear, p, nowMs);
  }
  return point(m, gear, p, nowMs);
}

/** Time passing: the tooltip shows once the pointer has rested on a stack for TOOLTIP_DELAY_MS. */
export function tick(m: BagMouse, nowMs: number): BagMouse {
  const { hover } = m;
  if (!hover || hover.tooltip || nowMs - hover.sinceMs < TOOLTIP_DELAY_MS) return m;
  return { ...m, hover: { ...hover, tooltip: true } };
}

/** The main button goes down: a click or the start of a drag, depending on what follows. */
export function pointerDown(m: BagMouse, gear: Gear, p: Pointer): BagMouse {
  return { ...m, pointer: p, press: { at: p, stack: under(gear, p) } };
}

/**
 * The main button comes up. Ending a drag, the item goes down where it would land if it fits there (`move`), or
 * else back where it was; either way it stays selected. Ending a click, it selects the stack clicked, or deselects
 * (clicking the selected one again, or empty space).
 */
export function pointerUp(
  m: BagMouse, gear: Gear, p: Pointer, nowMs: number, strength: number,
): { mouse: BagMouse; move: GearMove | null; tooWeak: WeaponId | null; noHands: NoHands | null } {
  const at = { ...m, pointer: p, press: null, drag: null };
  if (m.drag) {
    const to = landing({ ...m, pointer: p }, gear);
    const fits = !!to && canDrop({ ...m, pointer: p }, gear, strength) && !isWhereItWas(m.drag, to, gear);
    const move = fits ? { from: m.drag.from, to: to!, turned: m.drag.turned } : null;
    const after = move ? moveGear(gear, move.from, move.to, move.turned, strength) ?? gear : gear;
    return {
      mouse: point({ ...at, selected: move?.to ?? m.drag.from }, after, p, nowMs), move,
      tooWeak: !move && to ? tooWeakFor(gear, m.drag, to, strength) : null,
      noHands: !move && to ? noHandsFor(gear, m.drag, to, strength) : null,
    };
  }
  const clicked = m.press && (same(m.press.stack, m.selected) ? null : m.press.stack);
  const mouse = point({ ...at, selected: m.press ? clicked : m.selected }, gear, p, nowMs);
  return { mouse, move: null, tooWeak: null, noHands: null };
}

export interface NoHands { item: ItemId; displaced: ItemId }

/** The weapon a move into a hand was refused for: what would be held too heavy for its grip's strength. */
function tooWeakFor(gear: Gear, drag: Drag, to: Spot, strength: number): WeaponId | null {
  const anyStrength = moveGear(gear, drag.from, to, drag.turned, Infinity);
  const hand = anyStrength && unwieldableHand(anyStrength.equipment, strength);
  return hand ? anyStrength.equipment[hand] as WeaponId : null;
}

function noHandsFor(gear: Gear, drag: Drag, to: Spot, strength: number): NoHands | null {
  if (to.in !== "slot" || (to.slot !== "rightHand" && to.slot !== "leftHand")) return null;
  const other = to.slot === "rightHand" ? "leftHand" : "rightHand";
  const displaced = displacedBy(gear.equipment, drag.item, to.slot);
  const freed = { ...gear, equipment: { ...gear.equipment, [other]: null } };
  return displaced && moveGear(freed, drag.from, to, drag.turned, strength) ? { item: drag.item, displaced } : null;
}

/** Where the dragged item would land: its top-left kept inside the grid under it, or the slot. null over neither. */
export function landing(m: BagMouse, gear: Gear): Spot | null {
  const { drag, pointer } = m;
  const on = pointer?.over;
  if (!drag || !on) return null;
  if (on.in === "slot") return on;
  const grid = gear[on.in];
  const { cols, rows } = footprint(drag.item, drag.turned);
  return {
    in: on.in,
    x: clamp(on.x - drag.grip.x, 0, Math.max(0, grid.cols - cols)),
    y: clamp(on.y - drag.grip.y, 0, Math.max(0, grid.rows - rows)),
  };
}

const isWhereItWas = (drag: Drag, to: Spot, gear: Gear) =>
  same(drag.from, to) && (to.in === "slot" || stackAt(gear, drag.from)?.turned === drag.turned);

/** Whether the dragged item can go down where it would land. */
export function canDrop(m: BagMouse, gear: Gear, strength: number): boolean {
  const to = landing(m, gear);
  if (!m.drag || !to) return false;
  return isWhereItWas(m.drag, to, gear) || moveGear(gear, m.drag.from, to, m.drag.turned, strength) !== null;
}

/** Drop the drag (and a press) without moving anything: the item stays where it was. */
export const cancel = (m: BagMouse): BagMouse => (m.drag || m.press ? { ...m, drag: null, press: null } : m);

/**
 * Turning the stack covering a grid spot where it lies: a move to the same top-left, turned the other way. null if
 * there's nothing there, it's worn or square (it would look the same), or turned it wouldn't fit.
 */
export function turnInPlace(gear: Gear, spot: Spot): GearMove | null {
  const s = stackIn(gear, spot);
  if (!s || spot.in === "slot" || spot.in === "pile" || isSquare(s.item)) return null;
  const at = { in: spot.in, x: s.x, y: s.y };
  return moveItem(gear[at.in], at, at, !s.turned) ? { from: at, to: at, turned: !s.turned } : null;
}

type Turned = { mouse: BagMouse; move: GearMove | null };

/** The turn key: turns what's dragged (held by the same cell of it), or else the selected item in place. */
export function turnKey(m: BagMouse, gear: Gear): Turned {
  const { drag } = m;
  if (!drag) return { mouse: m, move: m.selected && turnInPlace(gear, m.selected) };
  if (isSquare(drag.item)) return { mouse: m, move: null };
  const turned = { ...drag, turned: !drag.turned, grip: { x: drag.grip.y, y: drag.grip.x } };
  return { mouse: { ...m, drag: turned }, move: null };
}

/** A right press: turns what's dragged, or else the item under the pointer in place (selected or not). */
export function rightPress(m: BagMouse, gear: Gear): Turned {
  if (m.drag) return turnKey(m, gear);
  const s = under(gear, m.pointer);
  return { mouse: m, move: s && turnInPlace(gear, s) };
}

/** Whether using it would do anything: it's consumable, and healing isn't wasted at full HP (the server refuses). */
function canUse(stack: BagItem, fullHp: boolean): boolean {
  const use = itemDef(stack.item).consumable;
  return !!use && !(fullHp && use.effects.every((effect) => "healShare" in effect));
}

export function itemToUse(m: BagMouse, gear: Gear, fullHp: boolean): UseSpot | null {
  const spot = m.drag ? null : m.selected;
  const s = stackAt(gear, spot);
  if (!s || !spot || spot.in === "slot" || spot.in === "pile" || spot.in === "quiver") return null;
  if (!canUse(s, fullHp)) return null;
  return { in: spot.in, x: spot.x, y: spot.y };
}

/** A double click selects what's under it (nothing, on empty space); then that's used (`itemToUse`). */
export function doubleClick(m: BagMouse, gear: Gear, p: Pointer): BagMouse {
  return { ...m, pointer: p, selected: under(gear, p) };
}

export const selectedStack = (m: BagMouse, gear: Gear): BagItem | null => stackAt(gear, m.selected);
export const hoveredStack = (m: BagMouse, gear: Gear): BagItem | null =>
  m.drag ? null : stackAt(gear, m.hover?.stack ?? null);

/**
 * The mouse after the gear changed (the server's word on it, a meal eaten, a fight lost): whatever was selected,
 * dragged, pressed or hovered that's no longer there is let go.
 */
export function keepUp(m: BagMouse, gear: Gear): BagMouse {
  const there = (spot: Spot | null | undefined) => !!spot && stackAt(gear, spot) !== null;
  const selected = there(m.selected) ? m.selected : null;
  const drag = m.drag && stackAt(gear, m.drag.from)?.item === m.drag.item ? m.drag : null;
  const press = m.press?.stack && !there(m.press.stack) ? null : m.press;
  const hover = there(m.hover?.stack) ? m.hover : null;
  if (selected === m.selected && drag === m.drag && press === m.press && hover === m.hover) return m;
  return { ...m, selected, drag, press, hover };
}
