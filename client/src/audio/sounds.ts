import type { ArenaLook, EnemyId, SkillElement, Spot, Theme } from "@infinite-tower/shared";
import type { GameEvent } from "../ui/notifications/say.js";

type Bus = "effects" | "ambient";

interface SoundDef {
  // Files `<stem>-1.ogg` to `<stem>-<variants>.ogg` in sounds/; the stem is the sound's name unless given.
  variants: number;
  stem?: string;
  volume: number;
  rate?: number;
  // Each play's rate and volume are off by up to this share, so repeats don't sound the same.
  spread?: number;
  bus?: Bus;
  loop?: true;
  // Heard this share of the place's hearing distance.
  reach?: number;
}

export const SOUNDS = {
  swing: { variants: 5, volume: 0.7, spread: 0.08 },
  "hit-blade": { variants: 3, volume: 0.9, spread: 0.08 },
  "hit-body": { variants: 5, volume: 0.9, spread: 0.08 },
  block: { variants: 5, volume: 0.8, spread: 0.06 },
  parry: { variants: 5, volume: 1, spread: 0.05 },
  "guard-break": { variants: 3, volume: 1, rate: 0.85, spread: 0.05 },
  slam: { variants: 2, volume: 1, rate: 0.8, spread: 0.05 },
  "draw-blade": { variants: 3, volume: 0.9, spread: 0.05 },
  dodge: { variants: 4, volume: 0.6, spread: 0.1 },
  jump: { variants: 2, volume: 0.5, spread: 0.1 },
  land: { variants: 3, volume: 0.5, spread: 0.1 },
  fall: { variants: 3, volume: 0.8, spread: 0.05 },
  "step-grass": { variants: 5, volume: 0.3, spread: 0.12, reach: 0.5 },
  "step-stone": { variants: 5, volume: 0.3, spread: 0.12, reach: 0.5 },
  "step-wet": { variants: 3, volume: 0.3, spread: 0.12, reach: 0.5 },
  victory: { variants: 1, volume: 0.6 },
  defeat: { variants: 1, volume: 0.6 },
  "boar-hurt": { variants: 5, volume: 0.8, rate: 1.15, spread: 0.08 },
  "boar-death": { variants: 1, volume: 0.9, rate: 1.1 },
  "boar-windup": { variants: 2, volume: 0.8, rate: 1.2, spread: 0.06 },
  "kobold-hurt": { variants: 5, volume: 0.8, rate: 1.1, spread: 0.08 },
  "kobold-death": { variants: 1, volume: 0.9 },
  "goblin-hurt": { variants: 3, volume: 0.8, rate: 1.6, spread: 0.08 },
  "goblin-death": { variants: 1, volume: 0.9, rate: 1.4 },
  "wolf-growl": { variants: 2, volume: 0.7, rate: 1.35, spread: 0.06 },
  "wolf-hurt": { variants: 2, volume: 0.8, rate: 1.3, spread: 0.08 },
  "wolf-death": { variants: 1, volume: 0.9, rate: 1.2 },
  "lurker-rise": { variants: 2, stem: "boar-windup", volume: 1, rate: 0.6, spread: 0.05 },
  "lurker-hurt": { variants: 5, stem: "boar-hurt", volume: 0.9, rate: 0.65, spread: 0.06 },
  "lurker-death": { variants: 1, stem: "boar-death", volume: 1, rate: 0.6 },
  "cast-fire": { variants: 4, volume: 0.8, spread: 0.06 },
  "cast-magic": { variants: 5, volume: 0.8, spread: 0.06 },
  "windup-magic": { variants: 1, volume: 0.5, spread: 0.06 },
  "bolt-fire": { variants: 1, stem: "campfire", volume: 0.5, rate: 1.6, loop: true },
  "bolt-water": { variants: 1, volume: 0.4, rate: 1.4, loop: true },
  "bolt-hum": { variants: 1, volume: 0.35, loop: true },
  "impact-fire": { variants: 2, volume: 0.9, spread: 0.08 },
  "impact-water": { variants: 2, volume: 0.9, spread: 0.08 },
  "impact-earth": { variants: 3, volume: 0.9, spread: 0.08 },
  "impact-air": { variants: 2, volume: 0.8, spread: 0.08 },
  "impact-magic": { variants: 2, volume: 0.9, spread: 0.08 },
  eat: { variants: 3, volume: 0.7, spread: 0.08 },
  rest: { variants: 1, volume: 0.6 },
  pickup: { variants: 2, volume: 0.6, spread: 0.06 },
  bag: { variants: 2, volume: 0.5, spread: 0.06 },
  equip: { variants: 2, volume: 0.5, spread: 0.05 },
  encounter: { variants: 3, volume: 0.7, spread: 0.04 },
  page: { variants: 3, volume: 0.6, spread: 0.05 },
  drop: { variants: 1, volume: 0.6 },
  notice: { variants: 1, volume: 0.4 },
  click: { variants: 3, volume: 0.3, spread: 0.03 },
  campfire: { variants: 1, volume: 0.7, bus: "ambient", loop: true, reach: 0.5 },
  river: { variants: 1, volume: 0.6, bus: "ambient", loop: true, reach: 0.6 },
  mire: { variants: 1, volume: 0.5, bus: "ambient", loop: true, reach: 0.6 },
} satisfies Record<string, SoundDef>;

export type SoundName = keyof typeof SOUNDS;

export const soundDef = (name: SoundName): SoundDef => SOUNDS[name];

export const fileOf = (name: SoundName, variant: number): string => `${soundDef(name).stem ?? name}-${variant}.ogg`;

export interface Take { variant: number; file: string; rate: number; gain: number }

export function take(name: SoundName, last: number | undefined, random: () => number): Take {
  const def = soundDef(name), others = def.variants > 1 && last !== undefined ? def.variants - 1 : def.variants;
  let variant = 1 + Math.min(others - 1, Math.floor(random() * others));
  if (others < def.variants && variant >= last!) variant++;
  const spread = def.spread ?? 0, off = () => 1 + spread * (2 * random() - 1);
  return { variant, file: fileOf(name, variant), rate: (def.rate ?? 1) * off(), gain: def.volume * off() };
}

interface EnemySounds { hurt: SoundName; death: SoundName; windup: SoundName | null }

export const ENEMY_SOUNDS: Record<EnemyId, EnemySounds> = {
  "wild-boar": { hurt: "boar-hurt", death: "boar-death", windup: "boar-windup" },
  "kobold-swordsman": { hurt: "kobold-hurt", death: "kobold-death", windup: "draw-blade" },
  "kobold-greatsword": { hurt: "kobold-hurt", death: "kobold-death", windup: "draw-blade" },
  "goblin-warlock": { hurt: "goblin-hurt", death: "goblin-death", windup: null },
  "grey-wolf": { hurt: "wolf-hurt", death: "wolf-death", windup: "wolf-growl" },
  "bog-lurker": { hurt: "lurker-hurt", death: "lurker-death", windup: "lurker-rise" },
  "training-dummy": { hurt: "hit-body", death: "fall", windup: null },
  bram: { hurt: "hit-body", death: "fall", windup: "draw-blade" },
};

interface ElementSounds { cast: SoundName; loop: SoundName; impact: SoundName; rate: number }

export const ELEMENT_SOUNDS: Record<SkillElement | "plain", ElementSounds> = {
  plain: { cast: "cast-magic", loop: "bolt-hum", impact: "impact-magic", rate: 1 },
  fire: { cast: "cast-fire", loop: "bolt-fire", impact: "impact-fire", rate: 1 },
  water: { cast: "cast-magic", loop: "bolt-water", impact: "impact-water", rate: 0.8 },
  earth: { cast: "cast-magic", loop: "bolt-hum", impact: "impact-earth", rate: 0.6 },
  air: { cast: "cast-magic", loop: "bolt-hum", impact: "impact-air", rate: 1.3 },
  lightning: { cast: "cast-magic", loop: "bolt-hum", impact: "impact-magic", rate: 1.6 },
  light: { cast: "cast-magic", loop: "bolt-hum", impact: "impact-magic", rate: 1.2 },
  darkness: { cast: "cast-magic", loop: "bolt-hum", impact: "impact-magic", rate: 0.7 },
};

export const STEP_SOUNDS: Record<ArenaLook, SoundName> = {
  "forest-clearing": "step-grass",
  "stone-ruins": "step-stone",
  mire: "step-wet",
  quarry: "step-stone",
};

export const ARENA_AMBIENCE: Partial<Record<ArenaLook, SoundName>> = { mire: "mire" };

export const RUNNING_WATER_SOUND: SoundName = "river";
export const STILL_WATER_SOUNDS: Partial<Record<Theme, SoundName>> = { mistwood: "mire" };

export const EVENT_SOUNDS: { readonly [K in GameEvent["kind"]]?: SoundName } = {
  encounter: "encounter",
  duel: "encounter",
  joinedFight: "encounter",
  joinedYou: "notice",
  challenge: "notice",
  rested: "rest",
  padBound: "notice",
  healed: "rest",
  itemUsed: "eat",
  given: "pickup",
  leftOnCloth: "drop",
  trade: "pickup",
};

export const bagSound = (from: Spot, to: Spot): SoundName =>
  from.in === "pile" ? "pickup" : to.in === "slot" ? "equip" : "bag";
