import { stowedCounts, type Stowed, type Tally } from "@infinite-tower/shared";

export function tallyText(tally: Tally, carried: Stowed): string {
  const have = "item" in tally ? Math.min(stowedCounts(carried)[tally.item] ?? 0, tally.need) : tally.kills;
  return `${have} / ${tally.need}`;
}
