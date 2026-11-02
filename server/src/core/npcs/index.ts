import type { EnemyId, Heading, NpcId, Vec2 } from "@infinite-tower/shared";
import type { ShopId } from "../content/shops.js";
import type { When } from "../game/story.js";
import { APOTHECARY } from "./apothecary.js";
import { BRAM } from "./bram.js";
import { BURNER } from "./burner.js";
import { CAPTAIN } from "./captain.js";
import { CHANGER } from "./changer.js";
import { CHRONICLER } from "./chronicler.js";
import { COOK } from "./cook.js";
import { CORWIN } from "./corwin.js";
import { FOREMAN } from "./foreman.js";
import { GROCER } from "./grocer.js";
import { HERALD } from "./herald.js";
import { HERBALIST } from "./herbalist.js";
import { HOLLIS } from "./hollis.js";
import { ILSE } from "./ilse.js";
import { MAREN } from "./maren.js";
import { PRIEST } from "./priest.js";
import { SCAVENGER } from "./scavenger.js";
import { SMITH } from "./smith.js";
import { TAMSIN } from "./tamsin.js";
import { TOBIN } from "./tobin.js";

export interface Talk {
  when?: When;
  lines: readonly string[];
  offer?: { start: string } | { deliver: string } | { shop: ShopId } | { train: EnemyId };
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
  changer: CHANGER,
  bram: BRAM,
  captain: CAPTAIN,
  cook: COOK,
  tamsin: TAMSIN,
  chronicler: CHRONICLER,
  priest: PRIEST,
  foreman: FOREMAN,
  scavenger: SCAVENGER,
  herbalist: HERBALIST,
  burner: BURNER,
};
