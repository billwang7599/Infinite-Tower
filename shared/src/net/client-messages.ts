/**
 * Client -> server messages, as Zod schemas: the client is untrusted. The client imports only the types, so Zod
 * stays out of its bundle; the server imports the schemas from "@infinite-tower/shared/net/client-messages".
 */
import { z } from "zod";
import { MAX_INPUTS_PER_MESSAGE, type StepInput } from "../battle/input.js";
import { ATTACK_KINDS } from "../battle/sword.js";
import { SLOTS, type Spot } from "../items/gear.js";
import { AUGMENTS, ELEMENTS, FORMS, SPELLBOOK_PAGES, type Spell } from "../spells/spell.js";
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

/** Two walk keys at once make a move √2 long; a little over, for the wire's rounding. */
const MAX_MOVE_LENGTH = Math.SQRT2 + 0.01;
const AIM_LENGTH_SLACK = 0.01;

const FightStep = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

// Far past any spell the stamina bar can pay for.
const MAX_SPELL_SEGMENTS = 16;
const MAX_WORDS_PER_BOX = 16;
// Far past any fight's enemies; one out of range just locks nothing.
const MAX_ENEMY_INDEX = 255;

const SegmentSchema = z.object({
  form: z.enum(FORMS),
  elements: z.array(z.enum(ELEMENTS)).max(ELEMENTS.length).readonly(),
  augments: z.array(z.enum(AUGMENTS)).max(MAX_WORDS_PER_BOX).readonly(),
});
export const SpellSchema = z.object({
  segments: z.tuple([SegmentSchema]).rest(SegmentSchema).readonly()
    .refine((s) => s.length <= MAX_SPELL_SEGMENTS, "too long"),
}) satisfies z.ZodType<Spell>;

const PageSchema = z.number().int().nonnegative().max(SPELLBOOK_PAGES - 1);

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
  cast: SpellSchema.nullable(),
  chant: z.boolean(),
  write: z.object({ page: PageSchema, spell: SpellSchema }).nullable(),
  locked: z.number().int().nonnegative().max(MAX_ENEMY_INDEX).nullable(),
})
  .refine((i) => Math.hypot(i.moveX, i.moveZ) <= MAX_MOVE_LENGTH, "moves faster than walking")
  .refine((i) => Math.abs(Math.hypot(i.aimX, i.aimZ) - 1) <= AIM_LENGTH_SLACK, "the aim isn't a direction") satisfies
  z.ZodType<StepInput>;

/**
 * Each change of input with its step, in order, and `upTo`, the last step the client's fight has run (nothing changed
 * until then). There's no message that says how a fight ended: only the server decides it.
 */
const BattleInputMsg = z.object({
  t: z.literal("battleInput"),
  upTo: FightStep,
  inputs: z.array(StepInputSchema).max(MAX_INPUTS_PER_MESSAGE),
})
  .refine((m) => m.inputs.every((input, i) => input.step > (m.inputs[i - 1]?.step ?? 0)), "steps out of order")
  .refine((m) => m.inputs.every((input) => input.step <= m.upTo), "a step after upTo");

/** The client's copy doesn't match the server's hash: it asks for the whole fight (`battleSync`). */
const BattleResyncMsg = z.object({ t: z.literal("battleResync") });

/** Back to the overworld after a fight's result. Ignored mid-fight. */
const LeaveBattleMsg = z.object({ t: z.literal("leaveBattle") });

const KEY = z.string().max(32);

/** Only what differs from the defaults; the client fills in the rest and ignores what it doesn't recognise. */
const SavedSettingsSchema = z.object({
  /** group -> action -> KeyboardEvent.code list */
  bindings: z.record(KEY, z.record(KEY, z.array(KEY).max(MAX_KEYS_PER_ACTION))).optional(),
  camera: z.object({ sensitivity: z.number().optional() }).optional(),
  /** Left out means on: saves from before it existed have no such field. */
  mouse: z.object({ autoLock: z.boolean().optional(), swingSensitivity: z.number().optional() }).optional(),
  /** Left out means on, as with `mouse.autoLock`. */
  hud: z.object({ showPing: z.boolean().optional() }).optional(),
});
export type SavedSettings = z.infer<typeof SavedSettingsSchema>;

const SettingsMsg = z.object({ t: z.literal("settings"), settings: SavedSettingsSchema });

/** Ignored if you have a character already. */
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

const RestMsg = z.object({ t: z.literal("rest") });

const GridSpot = z.object({
  in: z.enum(["bag", "cloth"]), x: z.number().int().nonnegative(), y: z.number().int().nonnegative(),
});
const SpotSchema = z.union([GridSpot, z.object({ in: z.literal("slot"), slot: z.enum(SLOTS) })]) satisfies
  z.ZodType<Spot>;

/** Overworld only. */
const UseItemMsg = z.object({ t: z.literal("useItem"), at: GridSpot });

const MoveItemMsg = z.object({ t: z.literal("moveItem"), from: SpotSchema, to: SpotSchema, turned: z.boolean() });

const CloseBagMsg = z.object({ t: z.literal("closeBag") });

const SaveSpellMsg = z.object({
  t: z.literal("saveSpell"), page: PageSchema, spell: SpellSchema,
});

/** The connection answers it with a `pong` itself; the game never sees it. */
const PingMsg = z.object({ t: z.literal("ping"), id: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) });

/** Ignored in production. `encounter` fights `enemy` (an id), or a wild boar. */
const DebugMsg = z.object({ t: z.literal("debug"), cmd: z.enum(["encounter"]), enemy: z.string().max(32).optional() });

export const ClientMsg = z.discriminatedUnion("t", [
  InputMsg, BattleInputMsg, BattleResyncMsg, LeaveBattleMsg, SettingsMsg, CharacterMsg, RestMsg, UseItemMsg,
  MoveItemMsg, CloseBagMsg, SaveSpellMsg, PingMsg, DebugMsg,
]);
export type ClientMsg = z.infer<typeof ClientMsg>;

export function parseClientMsg(raw: string): ClientMsg | null {
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return null; }
  const result = ClientMsg.safeParse(json);
  return result.success ? result.data : null;
}
