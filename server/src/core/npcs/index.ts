import type { Heading, NpcId, Vec2 } from "@infinite-tower/shared";
import type { When } from "../game/story.js";
import { APOTHECARY } from "./apothecary.js";
import { CORWIN } from "./corwin.js";
import { GROCER } from "./grocer.js";
import { HERALD } from "./herald.js";
import { HOLLIS } from "./hollis.js";
import { ILSE } from "./ilse.js";
import { MAREN } from "./maren.js";
import { SMITH } from "./smith.js";
import { TOBIN } from "./tobin.js";

export interface Talk {
  when?: When;
  lines: readonly string[];
  offer?: { start: string } | { deliver: string };
}

export interface Trace {
  at: Vec2;
  lines: readonly string[];
}

export interface Stop {
  when?: When;
  level: string;
  at: Vec2;
  heading: Heading;
  talk: readonly Talk[];
  /** Lies here for a player who sees the NPC at a stop listed before this one: one it has moved on to. */
  trace?: Trace;
}

/**
 * Each player sees an NPC at its first stop whose condition holds, saying the first talk there that holds: so its
 * stops are listed latest first.
 */
export interface Npc {
  stops: readonly Stop[];
}

export const NPCS: Record<NpcId, Npc> = {
  hollis: HOLLIS,
  maren: MAREN,
  tobin: TOBIN,
  corwin: CORWIN,
  ilse: ILSE,
  herald: HERALD,
  grocer: GROCER,
  apothecary: APOTHECARY,
  smith: SMITH,
};
