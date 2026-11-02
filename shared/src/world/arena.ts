export const ARENA_LOOK_IDS = ["forest-clearing", "stone-ruins", "mire", "quarry"] as const;
export type ArenaLook = (typeof ARENA_LOOK_IDS)[number];

export interface ArenaDef {
  id: string;
  radius: number;
  look: ArenaLook;
}
