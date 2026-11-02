import {
  bagCounts, carve, coinsFor, itemAt, itemDef, ITEM_IDS, sigilOf, uncarve, type CarvePrice, type Gear,
  type InscriptionId, type ItemId, type UseSpot,
} from "@infinite-tower/shared";
import { CARVE_PRICES, CARVING_SHOP, REMOVE_PRICES } from "../content/shops.js";
import type { GameSession } from "./session.js";
import { done, pay, receive, take, trading } from "./shop.js";

const worthOf = (item: ItemId): number => {
  const effect = itemDef(item).consumable?.effects.find((e) => "essence" in e);
  return effect && "essence" in effect ? effect.essence : 0;
};
const ESSENCES = ITEM_IDS.filter((item) => worthOf(item) > 0).sort((a, b) => worthOf(a) - worthOf(b));

function payEssence(gear: Gear, count: number): Gear | null {
  const bag = bagCounts(gear.bag), cloth = bagCounts(gear.cloth);
  let left = count, paid: Gear | null = gear;
  for (const item of ESSENCES) {
    const n = Math.min(left, (bag[item] ?? 0) + (cloth[item] ?? 0));
    if (n > 0) paid = paid && take(paid, item, n);
    left -= n;
  }
  return left === 0 ? paid : null;
}

type Paid = { gear: Gear } | { refused: "tooPoor" | "noEssence" | "noRoom" };

function payPrice(gear: Gear, price: CarvePrice): Paid {
  const coins = pay(gear, price.copper);
  if (!coins) return { refused: "tooPoor" };
  const essence = payEssence(coins.gear, price.essence);
  if (!essence) return { refused: "noEssence" };
  const got = receive(essence, coinsFor(coins.change));
  return got ? { gear: got.gear } : { refused: "noRoom" };
}

const carving = (session: GameSession): boolean => trading(session) === CARVING_SHOP;

export function carveSigil(session: GameSession, at: UseSpot): void {
  if (!carving(session)) return;
  const grid = session.gear[at.in], i = itemAt(grid, at), stack = grid.items[i];
  const inscription = stack && itemDef(stack.item).inscription;
  if (!stack || !inscription) return;
  const core = carve(session.core, inscription);
  if (!core) {
    const reason = session.core.inscriptions.includes(inscription) ? "carved" : "noSlot";
    return done(session, CARVING_SHOP, { kind: "refused", reason });
  }
  const items = grid.items.map((s, k) => k === i ? { ...s, count: s.count - 1 } : s).filter((s) => s.count > 0);
  const price = CARVE_PRICES[itemDef(stack.item).rarity];
  const paid = payPrice({ ...session.gear, [at.in]: { ...grid, items } }, price);
  if ("refused" in paid) return done(session, CARVING_SHOP, { kind: "refused", reason: paid.refused });
  session.takeCore(core);
  done(session, CARVING_SHOP, { kind: "carved", inscription, price }, paid.gear);
}

export function removeInscription(session: GameSession, inscription: InscriptionId): void {
  if (!carving(session)) return;
  const core = uncarve(session.core, inscription);
  if (!core) return done(session, CARVING_SHOP, { kind: "refused", reason: "notCarved" });
  const price = REMOVE_PRICES[itemDef(sigilOf(inscription)).rarity];
  const paid = payPrice(session.gear, price);
  if ("refused" in paid) return done(session, CARVING_SHOP, { kind: "refused", reason: paid.refused });
  session.takeCore(core);
  done(session, CARVING_SHOP, { kind: "uncarved", inscription, price }, paid.gear);
}
