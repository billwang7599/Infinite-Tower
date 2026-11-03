import type { EnemyId, RegionArea, Theme, Vec2 } from "@infinite-tower/shared";

export interface SpawnDef {
  enemy: EnemyId;
  at: Vec2;
  /** Seconds before a defeated one comes back. */
  respawnTime: number;
  /** Fought here rather than in the region's arena. */
  arenaId?: string;
}

export interface Spawn extends SpawnDef {
  /** Where it comes back instead while a player stands near `at`: across its region. */
  away: Vec2;
}

export interface EncounterTable {
  /** Roll every this many tiles walked in tall grass... */
  stepDist: number;
  /** ...with this chance. */
  chance: number;
  /** Which enemy, by weight. */
  enemies: { enemy: EnemyId; weight: number }[];
}

/** Written in its own tiles: every point in it is measured from the middle of `tiles`, as `origin` is in the world. */
export interface RegionDef {
  id: string;
  name: string;
  theme: Theme;
  /** Whole tiles, so its tiles line up with its neighbours'. */
  origin: Vec2;
  fill: string;
  tiles: string[];
  campfires: Vec2[];
  /** Where you wake when bound to it: the middle of its summoning pad, if it has one. */
  spawn: Vec2;
  arenaId: string;
  duelArenaId: string;
  /** Overworld actors, spawned when the world loads and respawned after they are defeated. */
  spawns: SpawnDef[];
  /** None: its tall grass, if any, starts no fights. */
  grass?: EncounterTable;
}

export interface Region extends RegionArea {
  spawn: Vec2;
  campfires: Vec2[];
  arenaId: string;
  duelArenaId: string;
  spawns: Spawn[];
  grass?: EncounterTable;
  hasPad: boolean;
}

export function rollEnemy(table: EncounterTable, rng: () => number): EnemyId {
  const total = table.enemies.reduce((s, e) => s + e.weight, 0);
  let r = rng() * total;
  for (const e of table.enemies) if ((r -= e.weight) < 0) return e.enemy;
  return table.enemies[table.enemies.length - 1]!.enemy;
}
