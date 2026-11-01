/**
 * The bag: a grid of cells, `x` the column and `y` the row from the top-left. Each item covers a rectangle and can be
 * turned 90°; a single-cell item stacks in one cell. Bags are replaced, never changed in place.
 */
import { ITEMS, type ItemCounts, type ItemId } from "./items.js";

export interface Cell {
  x: number;
  y: number;
}

/** One stack, by its top-left cell. */
export interface BagItem extends Cell {
  item: ItemId;
  count: number;
  /** Turned 90°: it covers `rows` across and `cols` down. */
  turned: boolean;
}

export interface Bag {
  cols: number;
  rows: number;
  items: BagItem[];
}

export const STARTER_BAG = { cols: 6, rows: 4 } as const;

export const emptyBag = (): Bag => ({ cols: STARTER_BAG.cols, rows: STARTER_BAG.rows, items: [] });

export function footprint(item: ItemId, turned: boolean): { cols: number; rows: number } {
  const { cols, rows } = ITEMS[item];
  return turned ? { cols: rows, rows: cols } : { cols, rows };
}

interface Area extends Cell {
  cols: number;
  rows: number;
}

const areaOf = (s: BagItem): Area => ({ x: s.x, y: s.y, ...footprint(s.item, s.turned) });
const overlap = (a: Area, b: Area) =>
  a.x < b.x + b.cols && b.x < a.x + a.cols && a.y < b.y + b.rows && b.y < a.y + a.rows;

/** -1 if the cell is empty. */
export const itemAt = (bag: Bag, cell: Cell): number =>
  bag.items.findIndex((s) => overlap(areaOf(s), { ...cell, cols: 1, rows: 1 }));

/** Whether `item` fits with its top-left at `at`. `ignore`: the index of a stack that doesn't count (the one moved). */
export function fits(bag: Bag, item: ItemId, at: Cell, turned: boolean, ignore = -1): boolean {
  const area = { x: at.x, y: at.y, ...footprint(item, turned) };
  if (!Number.isInteger(area.x) || !Number.isInteger(area.y) || area.x < 0 || area.y < 0) return false;
  if (area.x + area.cols > bag.cols || area.y + area.rows > bag.rows) return false;
  return bag.items.every((s, i) => i === ignore || !overlap(areaOf(s), area));
}

/** The first place `item` fits, along the top row and then down; turned only if it fits no other way. */
function findRoom(bag: Bag, item: ItemId): { at: Cell; turned: boolean } | null {
  for (const turned of [false, true]) {
    for (let y = 0; y < bag.rows; y++) {
      for (let x = 0; x < bag.cols; x++) if (fits(bag, item, { x, y }, turned)) return { at: { x, y }, turned };
    }
  }
  return null;
}

/** Tops up stacks of `item` first, then makes new ones where they fit. `left`: how many there wasn't room for. */
export function addItem(bag: Bag, item: ItemId, count: number): { bag: Bag; left: number } {
  const { stackSize } = ITEMS[item];
  let left = count;
  const items = bag.items.map((s) => {
    if (s.item !== item || s.count >= stackSize || left <= 0) return s;
    const added = Math.min(stackSize - s.count, left);
    left -= added;
    return { ...s, count: s.count + added };
  });
  let next: Bag = { ...bag, items };
  while (left > 0) {
    const room = findRoom(next, item);
    if (!room) break;
    const added = Math.min(stackSize, left);
    left -= added;
    next = { ...next, items: [...next.items, { item, count: added, ...room.at, turned: room.turned }] };
  }
  return { bag: next, left };
}

/**
 * The stack covering `from` moved so its top-left is at `to`. Dropped on a stack of the same item it tops that one up
 * instead, the rest staying put. null if nothing would change, or it doesn't fit there.
 */
export function moveItem(bag: Bag, from: Cell, to: Cell, turned: boolean): Bag | null {
  const i = itemAt(bag, from);
  const moving = bag.items[i];
  if (!moving) return null;
  const j = itemAt(bag, to);
  const target = bag.items[j];
  if (target && j !== i) {
    const moved = Math.min(ITEMS[target.item].stackSize - target.count, moving.count);
    if (target.item !== moving.item || moved <= 0) return null;
    const items = bag.items
      .map((s, k) => k === j ? { ...s, count: s.count + moved } : k === i ? { ...s, count: s.count - moved } : s)
      .filter((s) => s.count > 0);
    return { ...bag, items };
  }
  if (moving.x === to.x && moving.y === to.y && moving.turned === turned) return null;
  if (!fits(bag, moving.item, to, turned, i)) return null;
  return { ...bag, items: bag.items.map((s, k) => k === i ? { ...s, x: to.x, y: to.y, turned } : s) };
}

/** null if the cell is empty. */
export function takeOne(bag: Bag, cell: Cell): Bag | null {
  const i = itemAt(bag, cell);
  if (i < 0) return null;
  const items = bag.items.map((s, k) => k === i ? { ...s, count: s.count - 1 } : s).filter((s) => s.count > 0);
  return { ...bag, items };
}

export function takeItems(bag: Bag, item: ItemId, count: number): Bag | null {
  if ((bagCounts(bag)[item] ?? 0) < count) return null;
  let left = count;
  const items = bag.items.map((s) => {
    if (s.item !== item || left === 0) return s;
    const taken = Math.min(s.count, left);
    left -= taken;
    return { ...s, count: s.count - taken };
  });
  return { ...bag, items: items.filter((s) => s.count > 0) };
}

export const bagWeight = (bag: Bag): number => bag.items.reduce((sum, s) => sum + ITEMS[s.item].weight * s.count, 0);

export function bagCounts(bag: Bag): ItemCounts {
  const counts: ItemCounts = {};
  for (const s of bag.items) counts[s.item] = (counts[s.item] ?? 0) + s.count;
  return counts;
}

/** What's wrong with a bag, one line per problem; [] for a good one. */
export function bagProblems(bag: Bag): string[] {
  const problems: string[] = [];
  const placed: BagItem[] = [];
  for (const s of bag.items) {
    const name = `${s.item} at ${s.x},${s.y}`;
    if (!Object.hasOwn(ITEMS, s.item)) {
      problems.push(`${name}: no such item`);
      continue;
    }
    if (!Number.isInteger(s.count) || s.count < 1 || s.count > ITEMS[s.item].stackSize) {
      problems.push(`${name}: a stack of ${s.count}`);
    } else if (!fits({ ...bag, items: placed }, s.item, s, s.turned)) {
      problems.push(`${name}: outside the bag or over another item`);
    }
    placed.push(s);
  }
  return problems;
}
