import {
  addItem, bagCounts, bagWeight, fits, itemAt, moveItem, stackSizeIn, takeItems, type Bag, type BagItem,
} from "./bag.js";
import { unwieldableHand } from "../weapons/kinds.js";
import { twoHanded } from "../weapons/weapons.js";
import { itemDef, ITEMS, type ItemCounts, type ItemId, type WornOn } from "./items.js";

export const SLOTS = [
  "rightHand", "leftHand", "cap", "head", "body", "legs", "boots", "belt", "back", "hip", "leftWrist", "rightWrist",
  "ring1", "ring2", "ring3", "ring4", "ring5", "capCosmetic", "headCosmetic", "bodyCosmetic", "legsCosmetic",
  "bootsCosmetic",
] as const;
export type Slot = (typeof SLOTS)[number];
const SLOT_TAKES: Record<Slot, WornOn> = {
  rightHand: "hand", leftHand: "hand", cap: "cap", head: "head", body: "body", legs: "legs", boots: "boots",
  belt: "belt", back: "back", hip: "hip", leftWrist: "wrist", rightWrist: "wrist", ring1: "finger", ring2: "finger",
  ring3: "finger", ring4: "finger", ring5: "finger", capCosmetic: "cap", headCosmetic: "head", bodyCosmetic: "body",
  legsCosmetic: "legs", bootsCosmetic: "boots",
};
const COSMETIC_SLOTS: ReadonlySet<Slot> =
  new Set(["capCosmetic", "headCosmetic", "bodyCosmetic", "legsCosmetic", "bootsCosmetic"]);

export type Equipment = Record<Slot, ItemId | null>;

export const CLOTH = { cols: 8, rows: 6 } as const;

export interface Gear {
  bag: Bag;
  /** The worn backpack's own grid, apart from the bag; no cells without one. */
  pack: Bag;
  quiver: Bag;
  cloth: Bag;
  /** The overworld pile they have open (the server's; NO_PILE for none): things are only taken off it. */
  pile: Bag;
  equipment: Equipment;
}

/** What a player carries into a fight: the cloth and any pile stay behind. */
export type Carried = Omit<Gear, "cloth" | "pile">;
export type Stowed = Pick<Gear, "bag" | "pack" | "quiver">;
// Stowing and unstowing go in this order: a quiver takes only its arrows, which are used first.
const STOWED = ["quiver", "bag", "pack"] as const;
const WORN_GRID: Partial<Record<Slot, "pack" | "quiver">> = { back: "pack", hip: "quiver" };

export type GridName = "bag" | "pack" | "quiver" | "cloth" | "pile";
export type Spot = { in: GridName; x: number; y: number } | { in: "slot"; slot: Slot };
export type GridSpot = Extract<Spot, { in: GridName }>;
export type UseSpot = GridSpot & { in: "bag" | "pack" | "cloth" };

export const emptyEquipment = (): Equipment => Object.fromEntries(SLOTS.map((slot) => [slot, null])) as Equipment;
export const emptyCloth = (): Bag => ({ cols: CLOTH.cols, rows: CLOTH.rows, items: [] });
export const NO_PILE: Bag = { cols: 0, rows: 0, items: [] };

export function packFor(worn: ItemId | null): Bag {
  const pack = worn === null ? undefined : itemDef(worn).pack;
  return pack ? { ...pack, items: [] } : { cols: 0, rows: 0, items: [] };
}

export function fitsSlot(item: ItemId, slot: Slot): boolean {
  const worn = itemDef(item).wearable;
  return worn?.on === SLOT_TAKES[slot] && !!worn.cosmetic === COSMETIC_SLOTS.has(slot);
}
export type Hand = "rightHand" | "leftHand";
const isHand = (slot: Slot): slot is Hand => slot === "rightHand" || slot === "leftHand";
export const heldIn = (equipment: Pick<Equipment, Hand>, item: ItemId): Hand | null =>
  equipment.rightHand === item ? "rightHand" : equipment.leftHand === item ? "leftHand" : null;

export const stowedCounts = (gear: Stowed): ItemCounts =>
  bagCounts({ ...gear.bag, items: STOWED.flatMap((grid) => gear[grid].items) });

export function carriedCounts({ cloth, equipment, ...stowed }: Carried & { cloth?: Bag }): ItemCounts {
  const bag = cloth ? { ...stowed.bag, items: [...stowed.bag.items, ...cloth.items] } : stowed.bag;
  const counts = stowedCounts({ ...stowed, bag });
  for (const slot of SLOTS) {
    const item = equipment[slot];
    if (item !== null) counts[item] = (counts[item] ?? 0) + 1;
  }
  return counts;
}

export function stow<G extends Stowed>(gear: G, item: ItemId, count: number): { gear: G; left: number } {
  let left = count, out = gear;
  for (const grid of STOWED) {
    const added = addItem(out[grid], item, left);
    out = { ...out, [grid]: added.bag };
    left = added.left;
  }
  return { gear: out, left };
}

/**
 * Takes out of the hands, one at a time, any weapon too heavy for its grip (after strength drops): into the bag, or
 * `spilled` for a pile if there's no room.
 */
export function shedUnwieldable<G extends Stowed & { equipment: Equipment }>(
  gear: G, strength: number,
): { gear: G; spilled: ItemCounts } {
  let out = gear;
  const spilled: ItemCounts = {};
  for (let hand = unwieldableHand(out.equipment, strength); hand; hand = unwieldableHand(out.equipment, strength)) {
    const item = out.equipment[hand]!, put = stow({ ...out, equipment: { ...out.equipment, [hand]: null } }, item, 1);
    out = put.gear;
    if (put.left > 0) spilled[item] = (spilled[item] ?? 0) + put.left;
  }
  return { gear: out, spilled };
}

export function unstow<G extends Stowed>(gear: G, item: ItemId, count: number): G | null {
  if ((stowedCounts(gear)[item] ?? 0) < count) return null;
  let left = count, out = gear;
  for (const grid of STOWED) {
    const taken = Math.min(left, bagCounts(out[grid])[item] ?? 0);
    out = { ...out, [grid]: takeItems(out[grid], item, taken)! };
    left -= taken;
  }
  return out;
}

/** The cloth and a pile lie on the ground, so they don't count. */
export function gearWeight(gear: Carried): number {
  const worn = SLOTS.map((slot) => gear.equipment[slot]).filter((item) => item !== null);
  const stowed = STOWED.reduce((sum, grid) => sum + bagWeight(gear[grid]), 0);
  return stowed + worn.reduce((sum, item) => sum + ITEMS[item].weight, 0);
}

export function stackIn(gear: Gear, spot: Spot): BagItem | null {
  if (spot.in === "slot") {
    const item = gear.equipment[spot.slot];
    return item && { item, count: 1, x: 0, y: 0, turned: false };
  }
  const grid = gear[spot.in];
  return grid.items[itemAt(grid, spot)] ?? null;
}

const withGrid = (gear: Gear, name: GridName, grid: Bag): Gear => ({ ...gear, [name]: grid });

function lift(gear: Gear, spot: GridSpot): Gear {
  const grid = gear[spot.in];
  const i = itemAt(grid, spot);
  return withGrid(gear, spot.in, { ...grid, items: grid.items.filter((_, k) => k !== i) });
}

function takeOff(gear: Gear, slot: Slot, to: Spot): Gear | null {
  const grid = WORN_GRID[slot], equipment = { ...gear.equipment, [slot]: null };
  if (!grid) return { ...gear, equipment };
  if (gear[grid].items.length > 0 || to.in === grid) return null;
  return { ...gear, equipment, [grid]: packFor(null) };
}

const otherHand = (hand: Hand): Hand => (hand === "rightHand" ? "leftHand" : "rightHand");

export function displacedBy(equipment: Equipment, item: ItemId, hand: Hand): ItemId | null {
  const held = equipment[otherHand(hand)];
  return held && (twoHanded(item) || twoHanded(held)) ? held : null;
}

function freeOtherHand(gear: Gear, hand: Hand): Gear | null {
  const item = gear.equipment[hand], displaced = item && displacedBy(gear.equipment, item, hand);
  if (!displaced) return gear;
  const put = stow({ ...gear, equipment: { ...gear.equipment, [otherHand(hand)]: null } }, displaced, 1);
  return put.left === 0 ? put.gear : null;
}

/** `strength` is the wearer's own: into a hand, every weapon held after must reach its minimum at its grip. */
export function moveGear(gear: Gear, from: Spot, to: Spot, turned: boolean, strength: number): Gear | null {
  const moving = stackIn(gear, from);
  if (!moving || to.in === "pile") return null;
  if (from.in !== "slot" && to.in === from.in) {
    const moved = moveItem(gear[to.in], from, to, turned);
    return moved && withGrid(gear, to.in, moved);
  }
  if (to.in === "slot") {
    if (!fitsSlot(moving.item, to.slot) || moving.count !== 1) return null;
    let worn: Gear;
    if (from.in !== "slot") {
      if (gear.equipment[to.slot]) return null;
      const lifted = lift(gear, from), grid = WORN_GRID[to.slot];
      const equipment = { ...gear.equipment, [to.slot]: moving.item };
      worn = { ...lifted, ...(grid && { [grid]: packFor(moving.item) }), equipment };
    } else {
      if (from.slot === to.slot) return null;
      const there = gear.equipment[to.slot];
      if (there && !fitsSlot(there, from.slot)) return null;
      worn = { ...gear, equipment: { ...gear.equipment, [to.slot]: moving.item, [from.slot]: there } };
    }
    const held = isHand(to.slot) ? freeOtherHand(worn, to.slot) : worn;
    return held && (!isHand(to.slot) || unwieldableHand(held.equipment, strength) === null) ? held : null;
  }
  const target = gear[to.in];
  const onto = target.items[itemAt(target, to)];
  if (onto) {
    if (from.in === "slot" || onto.item !== moving.item) return null;
    const moved = Math.min(stackSizeIn(target, onto.item) - onto.count, moving.count);
    if (moved <= 0) return null;
    const source = gear[from.in];
    const left = source.items
      .map((s) => s === moving ? { ...s, count: s.count - moved } : s)
      .filter((s) => s.count > 0);
    const topped = target.items.map((s) => s === onto ? { ...s, count: s.count + moved } : s);
    return withGrid(withGrid(gear, from.in, { ...source, items: left }), to.in, { ...target, items: topped });
  }
  if (!fits(target, moving.item, to, turned)) return null;
  const rest = from.in === "slot" ? takeOff(gear, from.slot, to) : lift(gear, from);
  if (!rest) return null;
  const placed = { item: moving.item, count: moving.count, x: to.x, y: to.y, turned };
  return withGrid(rest, to.in, { ...rest[to.in], items: [...rest[to.in].items, placed] });
}
