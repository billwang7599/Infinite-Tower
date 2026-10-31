import type { Heading, NpcId, Vec2 } from "@infinite-tower/shared";
import type { When } from "../game/story.js";
import { HOLLIS } from "./hollis.js";
import { MAREN } from "./maren.js";
import { TOBIN } from "./tobin.js";

export interface Talk {
  when?: When;
  lines: readonly string[];
  offer?: { start: string } | { deliver: string };
}

export interface Stop {
  when?: When;
  level: string;
  at: Vec2;
  heading: Heading;
  talk: readonly Talk[];
}

/** Each player sees an NPC at its first stop whose condition holds, saying the first talk there that holds. */
export interface Npc {
  stops: readonly Stop[];
}

export const NPCS: Record<NpcId, Npc> = {
  hollis: HOLLIS,
  maren: MAREN,
  tobin: TOBIN,
};
