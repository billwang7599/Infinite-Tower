import { bagCounts, type Bag, type Tally } from "@infinite-tower/shared";

export function tallyText(tally: Tally, bag: Bag): string {
  const have = "item" in tally ? Math.min(bagCounts(bag)[tally.item] ?? 0, tally.need) : tally.kills;
  return `${have} / ${tally.need}`;
}
