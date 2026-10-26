/** The toasts that tell the player how a fight ended, from the server's `battleResult`. At most two. */
import { itemDef, type ItemCounts, type ItemId, type ServerMsgOf } from "@infinite-tower/shared";

export type BattleOutcome = Pick<ServerMsgOf<"battleResult">, "won" | "accepted" | "loot" | "leftBehind" | "lost">;

export function battleToasts(msg: BattleOutcome): string[] {
  const lost = describeItems(msg.lost);
  if (!msg.accepted) {
    return ["The server didn't accept that win.", ...(lost ? [`Everything you carried is gone: ${lost}.`] : [])];
  }
  if (!msg.won) return [lost ? `You died. Everything you carried is gone: ${lost}.` : "You died."];
  const toasts: string[] = [];
  // `loot` is everything the enemy dropped, `leftBehind` included.
  const packed = describeItems(subtractItems(msg.loot, msg.leftBehind));
  if (packed) toasts.push(`You found ${packed}.`);
  const leftBehind = describeItems(msg.leftBehind);
  if (leftBehind) toasts.push(`No room in your bag: you leave ${leftBehind} behind.`);
  return toasts;
}

/** "boar meat" / "2 boar meat", or "" for nothing. */
function describeItems(items: ItemCounts): string {
  return countEntries(items)
    .map(([id, n]) => `${n > 1 ? `${n} ` : ""}${itemDef(id).name.toLowerCase()}`)
    .join(", ");
}

/** What's left of `items` after taking `taken` away, item by item; an item none are left of is absent. */
function subtractItems(items: ItemCounts, taken: ItemCounts): ItemCounts {
  const left: ItemCounts = {};
  for (const [id, n] of countEntries(items)) {
    const rest = n - (taken[id] ?? 0);
    if (rest > 0) left[id] = rest;
  }
  return left;
}

const countEntries = (items: ItemCounts) => Object.entries(items) as [ItemId, number][];
