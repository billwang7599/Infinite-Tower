/**
 * What the game says about a fight's result (`battleResult`) once the player is back from the arena: what was found,
 * what was left behind, dying and what was lost. The fight's end itself has its own banner in the arena (BattleHud's
 * result), so these are corner notices (say.ts).
 */
import { itemDef, type ItemCounts, type ItemId, type ServerMsgOf } from "@infinite-tower/shared";

export type BattleOutcome = Pick<ServerMsgOf<"battleResult">, "won" | "loot" | "leftBehind" | "lost">;

/** How a fight ended, in at most two lines. Item lists are as long as what was found or lost. */
export function battleResultLines(outcome: BattleOutcome): string[] {
  const lost = describeItems(outcome.lost);
  if (!outcome.won) return [lost ? `You died. Everything you carried is gone: ${lost}.` : "You died."];
  const lines: string[] = [];
  // `loot` is everything the enemy dropped, `leftBehind` included.
  const packed = describeItems(subtractItems(outcome.loot, outcome.leftBehind));
  if (packed) lines.push(`You found ${packed}.`);
  const leftBehind = describeItems(outcome.leftBehind);
  if (leftBehind) lines.push(`No room in your bag: you leave ${leftBehind} behind.`);
  return lines;
}

/** "boar meat" / "2 boar meat", or "" for nothing. */
function describeItems(items: ItemCounts): string {
  return countEntries(items)
    .map(([id, count]) => `${count > 1 ? `${count} ` : ""}${itemDef(id).name.toLowerCase()}`)
    .join(", ");
}

/** What's left of `items` after taking `taken` away, item by item; an item none are left of is absent. */
function subtractItems(items: ItemCounts, taken: ItemCounts): ItemCounts {
  const left: ItemCounts = {};
  for (const [id, count] of countEntries(items)) {
    const rest = count - (taken[id] ?? 0);
    if (rest > 0) left[id] = rest;
  }
  return left;
}

const countEntries = (items: ItemCounts) => Object.entries(items) as [ItemId, number][];
