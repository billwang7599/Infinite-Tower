import { bagWeight, fits, itemAt, moveItem, type Bag, type BagItem } from "./bag.js";
import { canWield, isWeapon } from "../weapons/weapons.js";
import { itemDef, ITEMS, type ItemId, type WornOn } from "./items.js";

export const SLOTS = ["rightHand", "leftHand", "head", "body", "legs", "boots"] as const;
export type Slot = (typeof SLOTS)[number];
const SLOT_TAKES: Record<Slot, WornOn> = {
  rightHand: "hand", leftHand: "hand", head: "head", body: "body", legs: "legs", boots: "boots",
};

export type Equipment = Record<Slot, ItemId | null>;

export const CLOTH = { cols: 4, rows: 4 } as const;

export interface Gear {
  bag: Bag;
  cloth: Bag;
  /** The overworld pile they have open (the server's; NO_PILE for none): things are only taken off it. */
  pile: Bag;
  equipment: Equipment;
}

/** What a player carries into a fight: the cloth and any pile stay behind. */
export type Carried = Omit<Gear, "cloth" | "pile">;

export type GridName = "bag" | "cloth" | "pile";
export type Spot = { in: GridName; x: number; y: number } | { in: "slot"; slot: Slot };
export type GridSpot = Extract<Spot, { in: GridName }>;
export type UseSpot = GridSpot & { in: "bag" | "cloth" };

export const starterEquipment = (): Equipment =>
  ({ rightHand: "sword", leftHand: "skillbook", head: null, body: null, legs: null, boots: null });
export const emptyCloth = (): Bag => ({ cols: CLOTH.cols, rows: CLOTH.rows, items: [] });
export const NO_PILE: Bag = { cols: 0, rows: 0, items: [] };

export const fitsSlot = (item: ItemId, slot: Slot): boolean => itemDef(item).wearable?.on === SLOT_TAKES[slot];
export type Hand = "rightHand" | "leftHand";
export const heldIn = (equipment: Pick<Equipment, Hand>, item: ItemId): Hand | null =>
  equipment.rightHand === item ? "rightHand" : equipment.leftHand === item ? "leftHand" : null;

/** The cloth and a pile lie on the ground, so they don't count. */
export function gearWeight(gear: Gear): number {
  const worn = SLOTS.map((slot) => gear.equipment[slot]).filter((item) => item !== null);
  return bagWeight(gear.bag) + worn.reduce((sum, item) => sum + ITEMS[item].weight, 0);
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

export function moveGear(gear: Gear, from: Spot, to: Spot, turned: boolean, strength: number): Gear | null {
  const moving = stackIn(gear, from);
  if (!moving || to.in === "pile") return null;
  if (from.in !== "slot" && to.in === from.in) {
    const moved = moveItem(gear[to.in], from, to, turned);
    return moved && withGrid(gear, to.in, moved);
  }
  if (to.in === "slot") {
    if (!fitsSlot(moving.item, to.slot) || moving.count !== 1) return null;
    if (isWeapon(moving.item) && !canWield(moving.item, strength)) return null;
    if (from.in !== "slot") {
      if (gear.equipment[to.slot]) return null;
      return { ...lift(gear, from), equipment: { ...gear.equipment, [to.slot]: moving.item } };
    }
    if (from.slot === to.slot) return null;
    const there = gear.equipment[to.slot];
    if (there && !fitsSlot(there, from.slot)) return null;
    return { ...gear, equipment: { ...gear.equipment, [to.slot]: moving.item, [from.slot]: there } };
  }
  const target = gear[to.in];
  const onto = target.items[itemAt(target, to)];
  if (onto) {
    if (from.in === "slot" || onto.item !== moving.item) return null;
    const moved = Math.min(ITEMS[onto.item].stackSize - onto.count, moving.count);
    if (moved <= 0) return null;
    const source = gear[from.in];
    const left = source.items
      .map((s) => s === moving ? { ...s, count: s.count - moved } : s)
      .filter((s) => s.count > 0);
    const topped = target.items.map((s) => s === onto ? { ...s, count: s.count + moved } : s);
    return withGrid(withGrid(gear, from.in, { ...source, items: left }), to.in, { ...target, items: topped });
  }
  if (!fits(target, moving.item, to, turned)) return null;
  const rest = from.in === "slot" ? { ...gear, equipment: { ...gear.equipment, [from.slot]: null } } : lift(gear, from);
  const placed = { item: moving.item, count: moving.count, x: to.x, y: to.y, turned };
  return withGrid(rest, to.in, { ...target, items: [...target.items, placed] });
}
