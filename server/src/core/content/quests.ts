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
  "maren-waking": {
    title: "Woken",
    half: "main",
    steps: [
      {
        id: "boar",
        task: { kind: "kill", enemy: "wild-boar", count: 1 },
        text: "Slay a wild boar.",
        hint: "Maren said the boars root about in the tall grass across the brook, south of the camp.",
      },
      {
        id: "back",
        task: { kind: "talk", to: "maren" },
        text: "Go back to Maren.",
        hint: "She said she'd tell you what you are. She keeps the pad in the Hollow, by the fire.",
        reward: { lore: ["the-seed"] },
      },
    ],
  },
  "tobin-smoke": {
    title: "Meat for the Rack",
    half: "main",
    when: { done: "maren-waking" },
    steps: [
      {
        id: "gather",
        task: { kind: "gather", item: "boar-meat", count: 2 },
        text: "Gather 2 boar meat.",
        hint: "Tobin said a beaten boar leaves meat more often than not, and the Hollow's tall grass is full of them.",
      },
      {
        id: "bring",
        task: { kind: "deliver", item: "boar-meat", count: 2, to: "tobin" },
        text: "Bring the 2 boar meat to Tobin.",
        hint: "Tobin keeps watch by the footbridge over the Hollow's brook.",
        reward: { items: { "boar-hide": 1 }, lore: ["the-hollow"] },
      },
    ],
  },
  "maren-road": {
    title: "The Road East",
    half: "main",
    when: { done: "tobin-smoke" },
    steps: [
      {
        id: "hollis",
        task: { kind: "talk", to: "hollis" },
        text: "Find Hollis in the Grass Field.",
        hint: "Maren said the road east out of the Hollow runs into the Grass Field, and Hollis keeps a fire a good "
          + "walk along it.",
        reward: { items: { "boar-meat": 2 }, lore: ["natives"] },
      },
    ],
  },
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
        hint: "Hollis keeps the campfire in the Grass Field, a good walk along the road from the Hollow.",
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
  "tobin-kobold": {
    title: "How a Kobold Fights",
    half: "side",
    when: { done: "tobin-smoke" },
    steps: [
      {
        id: "kobold",
        task: { kind: "kill", enemy: "kobold-swordsman", count: 1 },
        text: "Slay a Kobold Swordsman.",
        hint: "Tobin said the Kobolds hold the Grass Field east of its river, and swing in twos and threes.",
      },
      {
        id: "back",
        task: { kind: "talk", to: "tobin" },
        text: "Tell Tobin how it fought.",
        hint: "He keeps watch by the footbridge in the Hollow.",
        reward: { items: { "boar-meat": 3 }, lore: ["kobolds"] },
      },
    ],
  },
  "maren-tongue": {
    title: "The Old Tongue",
    half: "side",
    when: { done: "maren-road" },
    steps: [
      {
        id: "mistwood",
        task: { kind: "reach", level: "mistwood" },
        text: "Go to the Mistwood.",
        hint: "Maren said it lies past the Grass Field, through the gap at its east edge.",
      },
      {
        id: "warlock",
        task: { kind: "kill", enemy: "goblin-warlock", count: 1 },
        text: "Hear a Goblin Warlock chant, then slay it.",
        hint: "Maren said the Mistwood's goblins chant among the broken walls in its south-east, past the water.",
      },
      {
        id: "back",
        task: { kind: "talk", to: "maren" },
        text: "Tell Maren what you heard.",
        hint: "She keeps the pad in the Hollow, by the fire.",
        reward: { items: { "boar-meat": 3 }, lore: ["old-tongue"] },
      },
    ],
  },
};
