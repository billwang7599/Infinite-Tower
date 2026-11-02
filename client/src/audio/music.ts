import type { ArenaLook, LevelLayout } from "@infinite-tower/shared";
import type { Mode } from "../game/transition.js";

type LevelTheme = LevelLayout["theme"];

// Each plays `music/<name>.ogg`, a seamless loop, all evened out to the same loudness.
export const TRACKS = {
  title: { volume: 0.5 },
  "grass-field": { volume: 0.45 },
  mistwood: { volume: 0.45 },
  battle: { volume: 0.55 },
  "battle-mire": { volume: 0.55 },
} satisfies Record<string, { volume: number }>;

export type TrackName = keyof typeof TRACKS;

interface Where { title: TrackName; overworld: Record<LevelTheme, TrackName>; battle: Record<ArenaLook, TrackName> }

export const MUSIC: Where = {
  title: "title",
  overworld: { "grass-field": "grass-field", mistwood: "mistwood", kingdom: "title", quarry: "mistwood" },
  battle: { "forest-clearing": "battle", "stone-ruins": "battle", mire: "battle-mire" },
};

export interface Scene { mode: Mode | null; level: LevelTheme | null; arena: ArenaLook | null; decided: boolean }

// A decided fight goes quiet, so the victory or defeat sound rings out.
export function musicFor({ mode, level, arena, decided }: Scene): TrackName | null {
  if (mode === "battle") return arena && !decided ? MUSIC.battle[arena] : null;
  return mode === "overworld" && level ? MUSIC.overworld[level] : MUSIC.title;
}
