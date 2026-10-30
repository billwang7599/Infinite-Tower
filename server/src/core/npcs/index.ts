import type { NpcId } from "@infinite-tower/shared";
import { HOLLIS } from "./hollis.js";

export interface Npc {
  /** Sent only when someone talks to them. */
  lines: readonly string[];
}

export const NPCS: Record<NpcId, Npc> = {
  hollis: HOLLIS,
};
