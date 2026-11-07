import type { EnemyId, Faith, ItemCounts, ItemId, NpcId, QuestHalf, Rect } from "@infinite-tower/shared";
import type { When } from "../game/story.js";
import { NPCS } from "../npcs/index.js";
import type { LoreId } from "./lore.js";

export type Task =
  | { kind: "gather"; item: ItemId; count: number }
  | { kind: "deliver"; item: ItemId; count: number; to: NpcId }
  | { kind: "reach"; region: string; area?: Rect }
  | { kind: "talk"; to: NpcId }
  | { kind: "kill"; enemy: EnemyId; count: number };

export interface QuestStep {
  /** Saved with each player: renaming one forgets the quest for anyone on it. */
  id: string;
  task: Task;
  text: string;
  hint: string;
  reward?: { items?: ItemCounts; flags?: readonly string[]; lore?: readonly LoreId[]; faith?: Faith };
}

export interface QuestDef {
  title: string;
  half: QuestHalf;
  when?: When;
  steps: readonly QuestStep[];
}

export type Quests = Readonly<Record<string, QuestDef>>;

/** Ids are saved with each player: renaming one loses it. The questbook lists them in this order, the admin's
 * Complete walks them in it, and a quest may only wait on one before it. */
export const QUEST_ORDER = [
  "bram-yard", "butcher-chickens", "maren-waking", "tobin-smoke", "maren-road", "hollis-hides", "hollis-pads",
  "hollis-loom", "tobin-kobold", "maren-tongue", "corwin-blind", "corwin-count", "ilse-weights", "ilse-snapped",
  "captain-boars", "cook-meat", "tamsin-son", "chronicler-roads", "foreman-pit", "scavenger-pelts",
  "scavenger-chanters", "herbalist-fangs", "herbalist-mist", "burner-rook",
] as const;

const WRITTEN: Quests = Object.assign({}, ...Object.values(NPCS).map((npc) => npc.quests ?? {}));

export const QUESTS: Quests = Object.fromEntries(QUEST_ORDER.map((id) => [id, WRITTEN[id]!]));
