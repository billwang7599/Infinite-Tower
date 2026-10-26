/**
 * Client -> server messages. The client is untrusted, so every message is a Zod schema: the server
 * runs each one through `parseClientMsg` and drops anything that doesn't match. The TypeScript types
 * are inferred from the schemas, so the two can't drift apart.
 *
 * The client imports only the types (`import type`), so Zod never reaches the browser bundle. That's
 * also why this file isn't re-exported as values from the package index: import the schemas from
 * "@infinite-tower/shared/net/client-messages".
 */
import { z } from "zod";
import type { Vitals } from "../battle/player.js";
import { ITEM_IDS } from "../items/items.js";
import { CHARACTER_NAME_RULES, GENDERS, LOOK_OPTIONS, type Character } from "../character/character.js";
import { MAX_KEYS_PER_ACTION } from "./settings.js";
import { ruledText } from "./text-schema.js";

const InputMsg = z.object({
  t: z.literal("input"),
  /** Increases by one per fixed tick. */
  seq: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  /** Clamped to [-1, 1] by the walking rules. */
  moveX: z.number(),
  moveZ: z.number(),
});

const VitalsSchema = z.object({ hp: z.number(), stamina: z.number() }) satisfies z.ZodType<Vitals>;

/** The fight was decided and the player left the arena, with this much HP and stamina left. */
const BattleEndMsg = z.object({ t: z.literal("battleEnd"), won: z.boolean(), vitals: VitalsSchema });

const KEY = z.string().max(32);

/**
 * The player's settings as saved: only what differs from the defaults (the client fills in the rest, and ignores
 * anything it doesn't recognise). Sent in `welcome`; the client sends a new copy after each change.
 */
const SavedSettingsSchema = z.object({
  /** group -> action -> KeyboardEvent.code list */
  bindings: z.record(KEY, z.record(KEY, z.array(KEY).max(MAX_KEYS_PER_ACTION))).optional(),
  camera: z.object({ sensitivity: z.number().optional() }).optional(),
});
export type SavedSettings = z.infer<typeof SavedSettingsSchema>;

const SettingsMsg = z.object({ t: z.literal("settings"), settings: SavedSettingsSchema });

/** Make your character. Only once: the server ignores it if you have one. It answers with `character`. */
const CharacterMsg = z.object({
  t: z.literal("character"),
  character: z.object({
    name: ruledText(CHARACTER_NAME_RULES, "Names"),
    gender: z.enum(GENDERS),
    look: z.object({
      body: z.enum(LOOK_OPTIONS.body), face: z.enum(LOOK_OPTIONS.face), skin: z.enum(LOOK_OPTIONS.skin),
      hair: z.enum(LOOK_OPTIONS.hair), hairColor: z.enum(LOOK_OPTIONS.hairColor), eyes: z.enum(LOOK_OPTIONS.eyes),
      eyeColor: z.enum(LOOK_OPTIONS.eyeColor), mouth: z.enum(LOOK_OPTIONS.mouth), outfit: z.enum(LOOK_OPTIONS.outfit),
      accent: z.enum(LOOK_OPTIONS.accent),
    }),
  }),
}) satisfies z.ZodType<{ t: "character"; character: Character }>;

/** Rest at the campfire you're standing by (the server checks you are). */
const RestMsg = z.object({ t: z.literal("rest") });

/** Use one of an item you carry (eat the meat). Only on the field. */
const UseItemMsg = z.object({ t: z.literal("useItem"), item: z.literal(ITEM_IDS) });

/** Dev-only commands (the server ignores them in production). */
const DebugMsg = z.object({ t: z.literal("debug"), cmd: z.enum(["encounter"]) });

export const ClientMsg = z.discriminatedUnion("t", [
  InputMsg, BattleEndMsg, SettingsMsg, CharacterMsg, RestMsg, UseItemMsg, DebugMsg,
]);
export type ClientMsg = z.infer<typeof ClientMsg>;

/** Raw text from the socket -> a valid message, or null. */
export function parseClientMsg(raw: string): ClientMsg | null {
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return null; }
  const result = ClientMsg.safeParse(json);
  return result.success ? result.data : null;
}
