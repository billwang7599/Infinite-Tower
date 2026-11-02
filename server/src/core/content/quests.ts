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
  "bram-yard": {
    title: "The Old Man's Yard",
    half: "main",
    steps: [
      {
        id: "bram",
        task: { kind: "talk", to: "bram" },
        text: "Find Bram in the training yard.",
        hint: "Aldric said old Bram keeps a yard off the castle courtyard, through the gap in its north-west wall.",
        reward: { items: { "old-stick": 1 } },
      },
      {
        id: "dummy",
        task: { kind: "kill", enemy: "training-dummy", count: 1 },
        text: "Knock down the training dummy.",
        hint: "Bram said it stays up until it's taken a light swing, a heavy one and a stab. Talk to him to begin.",
      },
      {
        id: "spar",
        task: { kind: "kill", enemy: "bram", count: 1 },
        text: "Best Bram in a spar.",
        hint: "Bram said he'll yield before he's hurt badly, and so should you. Talk to him in the yard to begin.",
        reward: { lore: ["soft-as-dough"] },
      },
    ],
  },
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
  "hollis-loom": {
    title: "The Pad and the Loom",
    half: "main",
    when: { done: "hollis-pads" },
    steps: [
      {
        id: "ilse",
        task: { kind: "talk", to: "ilse" },
        text: "Ask Ilse what her loom makes of the pad.",
        hint: "Hollis said she sits on the Mistwood lake's east shore, where the bridge comes in.",
      },
      {
        id: "back",
        task: { kind: "talk", to: "hollis" },
        text: "Go back to Hollis.",
        hint: "He's by the Mistwood's pad, where you come in from the Grass Field.",
        reward: { items: { "boar-meat": 3 }, lore: ["threadless-pads"] },
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
  "corwin-blind": {
    title: "A Blind on the East Road",
    half: "side",
    steps: [
      {
        id: "gather",
        task: { kind: "gather", item: "boar-hide", count: 2 },
        text: "Gather 2 boar hides.",
        hint: "Corwin said the Grass Field's boars root about in its tall grass, and not every one gives a hide.",
      },
      {
        id: "bring",
        task: { kind: "deliver", item: "boar-hide", count: 2, to: "corwin" },
        text: "Bring the 2 boar hides to Corwin.",
        hint: "Corwin keeps the Grass Field's east road, just south of it, near the gap to the Mistwood.",
        reward: { items: { "boar-meat": 2 }, lore: ["the-oath"] },
      },
    ],
  },
  "corwin-count": {
    title: "The Count",
    half: "side",
    when: { done: "corwin-blind" },
    steps: [
      {
        id: "kobolds",
        task: { kind: "kill", enemy: "kobold-swordsman", count: 2 },
        text: "Slay 2 Kobold Swordsmen.",
        hint: "Corwin said they come up out of the Grass Field's south-east corner, south-west of where he keeps "
          + "watch.",
      },
      {
        id: "back",
        task: { kind: "talk", to: "corwin" },
        text: "Go back to Corwin.",
        hint: "He keeps the Grass Field's east road, near the gap to the Mistwood.",
        reward: { items: { "boar-meat": 3 }, lore: ["pooled-soul"] },
      },
    ],
  },
  "ilse-weights": {
    title: "Weights for the Loom",
    half: "side",
    steps: [
      {
        id: "gather",
        task: { kind: "gather", item: "boar-tusk", count: 2 },
        text: "Gather 2 boar tusks.",
        hint: "Ilse said the boars carry them, the Mistwood's and the Grass Field's alike, though few give one up.",
      },
      {
        id: "bring",
        task: { kind: "deliver", item: "boar-tusk", count: 2, to: "ilse" },
        text: "Bring the 2 boar tusks to Ilse.",
        hint: "She sits by the Mistwood's path where it comes off the lake's bridge, on the east shore.",
        reward: { items: { "boar-meat": 2 }, lore: ["nyras-loom", "the-realms"] },
      },
    ],
  },
  "ilse-snapped": {
    title: "The Snapped Thread",
    half: "side",
    when: { done: "ilse-weights" },
    steps: [
      {
        id: "ruins",
        task: { kind: "reach", level: "mistwood", area: { x: 11, z: 12, w: 9, h: 5 } },
        text: "Go to the broken walls north of the lake.",
        hint: "Ilse said they stand in the Mistwood's north-east, up the path from where she sits.",
      },
      {
        id: "kobold",
        task: { kind: "kill", enemy: "kobold-swordsman", count: 1 },
        text: "Slay a Kobold Swordsman.",
        hint: "Ilse said one keeps the broken walls, and fights like nothing else in the wood.",
      },
      {
        id: "back",
        task: { kind: "talk", to: "ilse" },
        text: "Tell Ilse how it fought.",
        hint: "She sits by the Mistwood's path on the lake's east shore, where the bridge comes in.",
        reward: { items: { "boar-meat": 3 }, lore: ["snapped-tether"] },
      },
    ],
  },
};
