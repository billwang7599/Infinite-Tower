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
import { MAX_INPUTS_PER_MESSAGE, type StepInput } from "../battle/input.js";
import { ATTACK_KINDS } from "../battle/sword.js";
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

/**
 * Two walk keys at once, turned by the camera, make a move this long (√2); a little over, for the rounding to 3
 * decimals (battle/input.ts).
 */
const MAX_MOVE_LENGTH = Math.SQRT2 + 0.01;
/** The aim is a direction: length 1, give or take the rounding. */
const AIM_LENGTH_SLACK = 0.01;

/** A fight's step number: they count from 1. */
const FightStep = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

const StepInputSchema = z.object({
  step: FightStep,
  moveX: z.number(),
  moveZ: z.number(),
  aimX: z.number(),
  aimZ: z.number(),
  jump: z.boolean(),
  attack: z.enum(ATTACK_KINDS).nullable(),
  dodge: z.boolean(),
  block: z.boolean(),
})
  .refine((i) => Math.hypot(i.moveX, i.moveZ) <= MAX_MOVE_LENGTH, "moves faster than walking")
  .refine((i) => Math.abs(Math.hypot(i.aimX, i.aimZ) - 1) <= AIM_LENGTH_SLACK, "the aim isn't a direction") satisfies
  z.ZodType<StepInput>;

/**
 * What the player did in a fight: each change of input with the step it's for (it holds until the next), in step
 * order, and `upTo`, the last step their fight has run (so the server knows nothing changed until then). The
 * server runs the fight and decides it: there's no message that says how it ended.
 */
const BattleInputMsg = z.object({
  t: z.literal("battleInput"),
  upTo: FightStep,
  inputs: z.array(StepInputSchema).max(MAX_INPUTS_PER_MESSAGE),
})
  .refine((m) => m.inputs.every((input, i) => input.step > (m.inputs[i - 1]?.step ?? 0)), "steps out of order")
  .refine((m) => m.inputs.every((input) => input.step <= m.upTo), "a step after upTo");

/** The client's copy of the fight doesn't match the server's hash: it asks for the whole fight (`battleSync`). */
const BattleResyncMsg = z.object({ t: z.literal("battleResync") });

/** The player left the arena after the fight's result (the Leave key): back to the overworld. Ignored mid-fight. */
const LeaveBattleMsg = z.object({ t: z.literal("leaveBattle") });

const KEY = z.string().max(32);

/**
 * The player's settings as saved: only what differs from the defaults (the client fills in the rest, and ignores
 * anything it doesn't recognise). Sent in `welcome`; the client sends a new copy after each change.
 */
const SavedSettingsSchema = z.object({
  /** group -> action -> KeyboardEvent.code list */
  bindings: z.record(KEY, z.record(KEY, z.array(KEY).max(MAX_KEYS_PER_ACTION))).optional(),
  camera: z.object({ sensitivity: z.number().optional() }).optional(),
  /**
   * Capture the mouse as a battle starts. Left out means on (the default): saves from before it existed have no
   * such field. The client reads it (settings/mouse.ts); it never runs this schema, only its types.
   */
  mouse: z.object({ autoLock: z.boolean().optional() }).optional(),
  /** Left out means on, as with `mouse.autoLock`. */
  hud: z.object({ showPing: z.boolean().optional() }).optional(),
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

/** A bag cell (items/bag.ts). Only whole, non-negative numbers; whether it's in the bag is the bag's rules' call. */
const CellSchema = z.object({ x: z.number().int().nonnegative(), y: z.number().int().nonnegative() });

/** Use one of the item in that cell of your bag (eat the meat). Only on the overworld. */
const UseItemMsg = z.object({ t: z.literal("useItem"), at: CellSchema });

/**
 * Move what's in cell `from` so its top-left is at `to`, turned or not (`moveItem` in items/bag.ts). Overworld only.
 */
const MoveItemMsg = z.object({ t: z.literal("moveItem"), from: CellSchema, to: CellSchema, turned: z.boolean() });

/** For the HUD's ping: the connection answers at once with a `pong` of the same `id`; the game never sees it. */
const PingMsg = z.object({ t: z.literal("ping"), id: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) });

/** Dev-only commands (the server ignores them in production). `encounter` fights `enemy` (an id), or a wild boar. */
const DebugMsg = z.object({ t: z.literal("debug"), cmd: z.enum(["encounter"]), enemy: z.string().max(32).optional() });

export const ClientMsg = z.discriminatedUnion("t", [
  InputMsg, BattleInputMsg, BattleResyncMsg, LeaveBattleMsg, SettingsMsg, CharacterMsg, RestMsg, UseItemMsg,
  MoveItemMsg, PingMsg, DebugMsg,
]);
export type ClientMsg = z.infer<typeof ClientMsg>;

/** Raw text from the socket -> a valid message, or null. */
export function parseClientMsg(raw: string): ClientMsg | null {
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return null; }
  const result = ClientMsg.safeParse(json);
  return result.success ? result.data : null;
}
