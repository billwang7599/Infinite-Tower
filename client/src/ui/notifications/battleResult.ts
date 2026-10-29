/** What the game says about a fight's result once the player is back from the arena (the arena has its banner). */
import { itemDef, type ItemCounts, type ItemId, type ServerMsgOf } from "@infinite-tower/shared";

export type BattleOutcome = Pick<ServerMsgOf<"battleResult">, "won" | "loot" | "lost" | "duel">;

/** How a fight ended, in a line at most. Item lists are as long as what was dropped or lost. */
export function battleResultLines(outcome: BattleOutcome): string[] {
  if (outcome.duel) return [`You ${outcome.won ? "won" : "lost"} the duel against ${outcome.duel}.`];
  const lost = describeItems(outcome.lost);
  if (!outcome.won) return [lost ? `You died. Lost for good: ${lost}.` : "You died."];
  const dropped = describeItems(outcome.loot);
  return dropped ? [`Dropped where the fight began: ${dropped}.`] : [];
}

/** "boar meat" / "2 boar meat", or "" for nothing. */
export function describeItems(items: ItemCounts): string {
  return countEntries(items)
    .map(([id, count]) => `${count > 1 ? `${count} ` : ""}${itemDef(id).name.toLowerCase()}`)
    .join(", ");
}

const countEntries = (items: ItemCounts) => Object.entries(items) as [ItemId, number][];
