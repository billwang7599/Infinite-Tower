import { addItem, bagCounts, bagWeight, fits, itemAt, moveItem, takeItems, type Bag, type BagItem } from "./bag.js";
import { canWield, isWeapon } from "../weapons/weapons.js";
import { itemDef, ITEMS, type ItemCounts, type ItemId, type WornOn } from "./items.js";

export const SLOTS = [
  "rightHand", "leftHand", "cap", "head", "body", "legs", "boots", "belt", "back", "leftWrist", "rightWrist",
  "ring1", "ring2", "ring3", "ring4", "ring5", "capCosmetic", "headCosmetic", "bodyCosmetic", "legsCosmetic",
  "bootsCosmetic",
] as const;
export type Slot = (typeof SLOTS)[number];
const SLOT_TAKES: Record<Slot, WornOn> = {
  rightHand: "hand", leftHand: "hand", cap: "cap", head: "head", body: "body", legs: "legs", boots: "boots",
  belt: "belt", back: "back", leftWrist: "wrist", rightWrist: "wrist", ring1: "finger", ring2: "finger",
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
  cloth: Bag;
  /** The overworld pile they have open (the server's; NO_PILE for none): things are only taken off it. */
  pile: Bag;
  equipment: Equipment;
}

/** What a player carries into a fight: the cloth and any pile stay behind. */
export type Carried = Omit<Gear, "cloth" | "pile">;
export type Stowed = Pick<Gear, "bag" | "pack">;

export type GridName = "bag" | "pack" | "cloth" | "pile";
export type Spot = { in: GridName; x: number; y: number } | { in: "slot"; slot: Slot };
export type GridSpot = Extract<Spot, { in: GridName }>;
export type UseSpot = GridSpot & { in: "bag" | "pack" | "cloth" };

export const emptyEquipment = (): Equipment => Object.fromEntries(SLOTS.map((slot) => [slot, null])) as Equipment;
export const emptyCloth = (): Bag => ({ cols: CLOTH.cols, rows: CLOTH.rows, items: [] });
export const NO_PILE: Bag = { cols: 0, rows: 0, items: [] };

export function packFor(back: ItemId | null): Bag {
  const pack = back === null ? undefined : itemDef(back).pack;
  return { cols: pack?.cols ?? 0, rows: pack?.rows ?? 0, items: [] };
}

export function fitsSlot(item: ItemId, slot: Slot): boolean {
  const worn = itemDef(item).wearable;
  return worn?.on === SLOT_TAKES[slot] && !!worn.cosmetic === COSMETIC_SLOTS.has(slot);
}
export type Hand = "rightHand" | "leftHand";
export const heldIn = (equipment: Pick<Equipment, Hand>, item: ItemId): Hand | null =>
  equipment.rightHand === item ? "rightHand" : equipment.leftHand === item ? "leftHand" : null;

export const stowedCounts = ({ bag, pack }: Stowed): ItemCounts =>
  bagCounts({ ...bag, items: [...bag.items, ...pack.items] });

export function carriedCounts({ bag, pack, cloth, equipment }: Carried & { cloth?: Bag }): ItemCounts {
  const counts = stowedCounts({ bag: cloth ? { ...bag, items: [...bag.items, ...cloth.items] } : bag, pack });
  for (const slot of SLOTS) {
    const item = equipment[slot];
    if (item !== null) counts[item] = (counts[item] ?? 0) + 1;
  }
  return counts;
}

/** Into the bag first, then the backpack; `left`: how many fit in neither. */
export function stow<G extends Stowed>(gear: G, item: ItemId, count: number): { gear: G; left: number } {
  const inBag = addItem(gear.bag, item, count), inPack = addItem(gear.pack, item, inBag.left);
  return { gear: { ...gear, bag: inBag.bag, pack: inPack.bag }, left: inPack.left };
}

/** Out of the bag first, then the backpack; null if there aren't that many. */
export function unstow<G extends Stowed>(gear: G, item: ItemId, count: number): G | null {
  const fromBag = Math.min(count, bagCounts(gear.bag)[item] ?? 0);
  const bag = takeItems(gear.bag, item, fromBag), pack = takeItems(gear.pack, item, count - fromBag);
  return bag && pack ? { ...gear, bag, pack } : null;
}

/** The cloth and a pile lie on the ground, so they don't count. */
export function gearWeight(gear: Carried): number {
  const worn = SLOTS.map((slot) => gear.equipment[slot]).filter((item) => item !== null);
  return bagWeight(gear.bag) + bagWeight(gear.pack) + worn.reduce((sum, item) => sum + ITEMS[item].weight, 0);
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

/** The backpack comes off only empty, and never into its own grid. */
function takeOff(gear: Gear, slot: Slot, to: Spot): Gear | null {
  if (slot !== "back") return { ...gear, equipment: { ...gear.equipment, [slot]: null } };
  if (gear.pack.items.length > 0 || to.in === "pack") return null;
  return { ...gear, equipment: { ...gear.equipment, back: null }, pack: packFor(null) };
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
      const lifted = lift(gear, from);
      const pack = to.slot === "back" ? packFor(moving.item) : lifted.pack;
      return { ...lifted, pack, equipment: { ...gear.equipment, [to.slot]: moving.item } };
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
  const rest = from.in === "slot" ? takeOff(gear, from.slot, to) : lift(gear, from);
  if (!rest) return null;
  const placed = { item: moving.item, count: moving.count, x: to.x, y: to.y, turned };
  return withGrid(rest, to.in, { ...rest[to.in], items: [...rest[to.in].items, placed] });
}
