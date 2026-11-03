import type { ArenaLook, Theme } from "@infinite-tower/shared";
import type { Mode } from "../game/transition.js";

// Each plays `music/<name>.ogg`, a seamless loop, all evened out to the same loudness.
export const TRACKS = {
  title: { volume: 0.5 },
  "grass-field": { volume: 0.45 },
  mistwood: { volume: 0.45 },
  quarry: { volume: 0.45 },
  battle: { volume: 0.55 },
  "battle-mire": { volume: 0.55 },
} satisfies Record<string, { volume: number }>;

export type TrackName = keyof typeof TRACKS;

interface Where { title: TrackName; overworld: Record<Theme, TrackName>; battle: Record<ArenaLook, TrackName> }

export const MUSIC: Where = {
  title: "title",
  overworld: { "grass-field": "grass-field", mistwood: "mistwood", kingdom: "title", quarry: "quarry" },
  battle: { "forest-clearing": "battle", "stone-ruins": "battle", mire: "battle-mire", quarry: "battle" },
};

export interface Scene { mode: Mode | null; region: Theme | null; arena: ArenaLook | null; decided: boolean }

// A decided fight goes quiet, so the victory or defeat sound rings out.
export function musicFor({ mode, region, arena, decided }: Scene): TrackName | null {
  if (mode === "battle") return arena && !decided ? MUSIC.battle[arena] : null;
  return mode === "overworld" && region ? MUSIC.overworld[region] : MUSIC.title;
}
