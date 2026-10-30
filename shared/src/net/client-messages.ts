/**
 * Client -> server messages, as Zod schemas: the client is untrusted. The client imports only the types, so Zod
 * stays out of its bundle; the server imports the schemas from "@infinite-tower/shared/net/client-messages".
 */
import { z } from "zod";
import { MAX_INPUTS_PER_MESSAGE, type StepInput } from "../battle/input.js";
import { ATTACK_KINDS } from "../weapons/weapons.js";
import { SLOTS, type Spot, type UseSpot } from "../items/gear.js";
import { ITEM_IDS, type ItemId } from "../items/items.js";
import { ENEMY_IDS } from "../battle/defs.js";
import { MODIFIERS, ELEMENTS, FORMS, SKILLBOOK_PAGES, type Skill } from "../skills/skill.js";
import { CHARACTER_NAME_RULES, GENDERS, LOOK_OPTIONS, type Character } from "../character/character.js";
import { MAX_KEYS_PER_ACTION, OVERWORLD_CAMERA_ANGLES } from "./settings.js";
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

// Far past any fight's enemies; one out of range just locks nothing.
const MAX_ENEMY_INDEX = 255;

const SegmentSchema = z.object({
  form: z.enum(FORMS),
  elements: z.array(z.enum(ELEMENTS)).max(ELEMENTS.length).readonly(),
  modifiers: z.array(z.enum(MODIFIERS)).readonly(),
});
export const SkillSchema = z.object({
  segments: z.tuple([SegmentSchema]).rest(SegmentSchema).readonly(),
}) satisfies z.ZodType<Skill>;

const PageSchema = z.number().int().nonnegative().max(SKILLBOOK_PAGES - 1);

const Cell = { x: z.number().int().nonnegative(), y: z.number().int().nonnegative() };
const GridSpot = z.object({ in: z.enum(["bag", "cloth", "pile"]), ...Cell });
const SpotSchema = z.union([GridSpot, z.object({ in: z.literal("slot"), slot: z.enum(SLOTS) })]) satisfies
  z.ZodType<Spot>;
const UseSpotSchema = z.object({ in: z.enum(["bag", "cloth"]), ...Cell }) satisfies z.ZodType<UseSpot>;

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
  cast: SkillSchema.nullable(),
  castHeld: z.boolean(),
  chant: z.boolean(),
  chantWords: z.array(z.union([z.enum(FORMS), z.enum(ELEMENTS), z.enum(MODIFIERS)])).readonly().nullable(),
  write: z.object({ page: PageSchema, skill: SkillSchema }).nullable(),
  locked: z.number().int().nonnegative().max(MAX_ENEMY_INDEX).nullable(),
  bag: z.boolean(),
  gear: z.object({ from: SpotSchema, to: SpotSchema, turned: z.boolean() }).nullable(),
  use: UseSpotSchema.nullable(),
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
const VOLUME = z.number().min(0).max(1).optional();

/** Only what differs from the defaults; the client fills in the rest and ignores what it doesn't recognise. */
const SavedSettingsSchema = z.object({
  /** group -> action -> KeyboardEvent.code list */
  bindings: z.record(KEY, z.record(KEY, z.array(KEY).max(MAX_KEYS_PER_ACTION))).optional(),
  camera: z.object({
    sensitivity: z.number().optional(),
    overworldTurns: z.number().int().min(0).max(OVERWORLD_CAMERA_ANGLES - 1).optional(),
  }).optional(),
  /** Left out means on: saves from before it existed have no such field. */
  mouse: z.object({ autoLock: z.boolean().optional(), swingSensitivity: z.number().optional() }).optional(),
  /** Left out means on, as with `mouse.autoLock`. */
  hud: z.object({ showPing: z.boolean().optional() }).optional(),
  audio: z.object({ master: VOLUME, effects: VOLUME, ambient: VOLUME, music: VOLUME }).optional(),
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

const UseItemMsg = z.object({ t: z.literal("useItem"), at: UseSpotSchema });

const MoveItemMsg = z.object({ t: z.literal("moveItem"), from: SpotSchema, to: SpotSchema, turned: z.boolean() });

const CloseBagMsg = z.object({ t: z.literal("closeBag") });

const OpenPileMsg = z.object({ t: z.literal("openPile") });

const TalkMsg = z.object({ t: z.literal("talk") });

const SaveSkillMsg = z.object({
  t: z.literal("saveSkill"), page: PageSchema, skill: SkillSchema,
});

const ChallengeMsg = z.object({ t: z.literal("challenge") });
const JoinBattleMsg = z.object({ t: z.literal("joinBattle") });
const AnswerChallengeMsg = z.object({ t: z.literal("answerChallenge"), accept: z.boolean() });

/** No length cap here: the server checks it and tells the sender. */
const ChatMsg = z.object({ t: z.literal("chat"), text: z.string().trim().min(1) });

/** The connection answers it with a `pong` itself; the game never sees it. */
const PingMsg = z.object({ t: z.literal("ping"), id: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) });

export const MAX_GIVE_COUNT = 100;

const CheatSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("encounter"), enemy: z.enum(ENEMY_IDS) }),
  z.object({ kind: z.literal("invulnerable"), on: z.boolean() }),
  z.object({
    kind: z.literal("give"), item: z.enum(ITEM_IDS as [ItemId, ...ItemId[]]),
    count: z.number().int().min(1).max(MAX_GIVE_COUNT),
  }),
  z.object({ kind: z.literal("heal") }),
]);
export type Cheat = z.infer<typeof CheatSchema>;

/** Dev servers only: production ignores it. */
const CheatMsg = z.object({ t: z.literal("cheat"), cheat: CheatSchema });

export const ClientMsg = z.discriminatedUnion("t", [
  InputMsg, BattleInputMsg, BattleResyncMsg, LeaveBattleMsg, SettingsMsg, CharacterMsg, RestMsg, UseItemMsg,
  MoveItemMsg, CloseBagMsg, OpenPileMsg, TalkMsg, SaveSkillMsg, PingMsg, CheatMsg, ChallengeMsg, AnswerChallengeMsg,
  JoinBattleMsg, ChatMsg,
]);
export type ClientMsg = z.infer<typeof ClientMsg>;

export function parseClientMsg(raw: string): ClientMsg | null {
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return null; }
  const result = ClientMsg.safeParse(json);
  return result.success ? result.data : null;
}
