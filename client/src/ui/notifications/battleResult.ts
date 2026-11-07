/** What the game says about a fight's result once the player is back from the arena (the arena says only who won). */
import { coreName, itemDef, type ItemCounts, type ItemId, type ServerMsgOf } from "@infinite-tower/shared";

export type BattleOutcome = Pick<ServerMsgOf<"battleResult">, "won" | "lost" | "duel" | "spar" | "core" | "coreLost">;

export function battleResultLines(outcome: BattleOutcome): string[] {
  if (outcome.duel) return [`You ${outcome.won ? "won" : "lost"} the duel against ${outcome.duel}.`];
  if (outcome.spar) return outcome.won ? [] : [`You yield to ${outcome.spar}.`];
  const lost = describeItems(outcome.lost);
  if (outcome.won) return [];
  const died = lost ? `You died and dropped ${lost}; what's left of it lands where the fight began.` : "You died.";
  if (outcome.coreLost === "fill") return [died, "Your core dims: the essence it held is gone."];
  if (outcome.coreLost === "step") return [died, `Your core dims: it falls back to ${coreName(outcome.core)}.`];
  return [died];
}

export function describeItems(items: ItemCounts): string {
  return countEntries(items).map(([id, count]) => {
    const name = itemDef(id).name.toLowerCase();
    return count > 1 ? `${count} ${plural(name)}` : name;
  }).join(", ");
}

const UNCOUNTED = /(meat|bread|essence)$/;

function plural(name: string): string {
  const [head = name, ...of] = name.split(" of ");
  if (UNCOUNTED.test(head)) return name;
  return [`${head}${/(s|x|ch|sh)$/.test(head) ? "es" : "s"}`, ...of].join(" of ");
}

const countEntries = (items: ItemCounts) => Object.entries(items) as [ItemId, number][];
