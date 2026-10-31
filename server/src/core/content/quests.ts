import type { EnemyId, ItemCounts, ItemId, NpcId, QuestHalf, Rect } from "@infinite-tower/shared";
import type { When } from "../game/story.js";
import type { LoreId } from "./lore.js";

export type Task =
  | { kind: "gather"; item: ItemId; count: number }
  | { kind: "deliver"; item: ItemId; count: number; to: NpcId }
  | { kind: "reach"; level: string; area?: Rect }
  | { kind: "talk"; to: NpcId }
  | { kind: "kill"; enemy: EnemyId; count: number };

export interface QuestStep {
  /** Saved with each player: renaming one forgets the quest for anyone on it. */
  id: string;
  task: Task;
  text: string;
  hint: string;
  reward?: { items?: ItemCounts; flags?: readonly string[]; lore?: readonly LoreId[] };
}

export interface QuestDef {
  title: string;
  half: QuestHalf;
  when?: When;
  steps: readonly QuestStep[];
}

export type Quests = Readonly<Record<string, QuestDef>>;

/** Ids are saved with each player: renaming one loses it. */
export const QUESTS: Quests = {
  "hollis-hides": {
    title: "Hides for the Fire",
    half: "main",
    steps: [
      {
        id: "gather",
        task: { kind: "gather", item: "boar-hide", count: 2 },
        text: "Gather 2 boar hides.",
        hint: "Hollis said the boars roam the Grass Field and hide in its tall grass, and not every one has a hide "
          + "worth keeping.",
      },
      {
        id: "bring",
        task: { kind: "deliver", item: "boar-hide", count: 2, to: "hollis" },
        text: "Bring the 2 boar hides to Hollis.",
        hint: "Hollis keeps the campfire in the Grass Field, a few steps from where you woke.",
        reward: { items: { "boar-meat": 2 }, lore: ["avatars"] },
      },
    ],
  },
  "hollis-pads": {
    title: "Where You Woke",
    half: "main",
    when: { done: "hollis-hides" },
    steps: [
      {
        id: "boars",
        task: { kind: "kill", enemy: "wild-boar", count: 3 },
        text: "Slay 3 wild boars.",
        hint: "Hollis said they come thickest in the tall grass, and one roams east of his fire.",
      },
      {
        id: "back",
        task: { kind: "talk", to: "hollis" },
        text: "Go back to Hollis.",
        hint: "He said he has something to tell you about where you woke. He's by his fire in the Grass Field.",
        reward: { items: { "boar-meat": 3 }, flags: ["hollis-to-mistwood"], lore: ["summoning-pads"] },
      },
    ],
  },
};
