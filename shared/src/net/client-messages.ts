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
import type { Vitals } from "../battle/constants.js";
import { ITEM_IDS, type ItemId } from "../items/items.js";
import { CHARACTER_NAME_RULES, LOOKS, type Character, type Look, type LookPart } from "../character/character.js";

const finite = z.number().finite();

export const InputMsg = z.object({
  t: z.literal("input"),
  /** Increases by one per fixed tick. */
  seq: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  /** Clamped to [-1, 1] by the walking rules. */
  moveX: finite,
  moveZ: finite,
});

const VitalsSchema = z.object({ hp: finite, stamina: finite }) satisfies z.ZodType<Vitals>;

/** The fight was decided and the player left the arena, with this much HP and stamina left. */
export const BattleEndMsg = z.object({ t: z.literal("battleEnd"), won: z.boolean(), vitals: VitalsSchema });

const KEY = z.string().max(32);

/**
 * The player's settings as saved: only what differs from the defaults (the client fills in the rest, and ignores
 * anything it doesn't recognise). Sent in `welcome`; the client sends a new copy after each change.
 */
export const SavedSettingsSchema = z.object({
  /** group -> action -> KeyboardEvent.code list */
  bindings: z.record(KEY, z.record(KEY, z.array(KEY).max(3))).optional(),
  camera: z.object({ sensitivity: finite.optional() }).optional(),
});
export type SavedSettings = z.infer<typeof SavedSettingsSchema>;

export const SettingsMsg = z.object({ t: z.literal("settings"), settings: SavedSettingsSchema });

const lookPart = <P extends LookPart>(part: P) =>
  z.enum(LOOKS[part].map((o) => o.id) as unknown as [Look[P], ...Look[P][]]);
const NAME_HELP = `Names are ${CHARACTER_NAME_RULES.min}-${CHARACTER_NAME_RULES.max} letters, digits, spaces, ' or -.`;

/** Create or change your character (name + look). The server answers with `character`. */
export const CharacterMsg = z.object({
  t: z.literal("character"),
  character: z.object({
    name: z.string().trim()
      .min(CHARACTER_NAME_RULES.min, NAME_HELP).max(CHARACTER_NAME_RULES.max, NAME_HELP)
      .regex(new RegExp(CHARACTER_NAME_RULES.pattern), NAME_HELP),
    look: z.object({ cloak: lookPart("cloak"), skin: lookPart("skin"), legs: lookPart("legs") }),
  }),
}) satisfies z.ZodType<{ t: "character"; character: Character }>;

/** Rest at the campfire you're standing by (the server checks you are). */
export const RestMsg = z.object({ t: z.literal("rest") });

/** Use one of an item you carry (eat the meat). Only on the field. */
export const UseItemMsg = z.object({ t: z.literal("useItem"), item: z.enum(ITEM_IDS as [ItemId, ...ItemId[]]) });

/** Dev-only commands (the server ignores them in production). */
export const DebugMsg = z.object({ t: z.literal("debug"), cmd: z.enum(["encounter"]) });

export const ClientMsg = z.discriminatedUnion("t", [InputMsg, BattleEndMsg, SettingsMsg, CharacterMsg, RestMsg, UseItemMsg, DebugMsg]);
export type ClientMsg = z.infer<typeof ClientMsg>;

/** Raw text from the socket -> a valid message, or null. */
export function parseClientMsg(raw: string): ClientMsg | null {
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return null; }
  const result = ClientMsg.safeParse(json);
  return result.success ? result.data : null;
}
