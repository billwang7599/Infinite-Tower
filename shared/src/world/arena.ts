export const ARENA_LOOK_IDS = ["forest-clearing", "stone-ruins", "mire"] as const;
export type ArenaLook = (typeof ARENA_LOOK_IDS)[number];

export interface ArenaDef {
  id: string;
  radius: number;
  look: ArenaLook;
}
