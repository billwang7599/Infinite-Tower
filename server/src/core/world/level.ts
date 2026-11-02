/** A level. Only `layout` is sent to the client; the rest stays here so a player can't read or change it. */
import type { EnemyId, LevelMap, Rect, Vec2 } from "@infinite-tower/shared";

export interface SpawnDef {
  enemy: EnemyId;
  at: Vec2;
  /** Seconds before a defeated one comes back. */
  respawnTime: number;
  /** Fought here rather than in the level's arena. */
  arenaId?: string;
}

export interface EncounterTable {
  /** Roll every this many tiles walked in tall grass... */
  stepDist: number;
  /** ...with this chance. */
  chance: number;
  /** Which enemy, by weight. */
  enemies: { enemy: EnemyId; weight: number }[];
}

export interface ExitDef {
  /** Tiles at the map's edge: walking into it takes you to level `to`, at `at`. */
  area: Rect;
  to: string;
  at: Vec2;
}

export interface LevelDef {
  layout: LevelMap;
  /** Where you appear when you enter, and wake up after losing a fight. */
  spawn: Vec2;
  arenaId: string;
  duelArenaId: string;
  /** Overworld actors, spawned when the level loads and respawned after they are defeated. */
  spawns: SpawnDef[];
  /** None: its tall grass, if any, starts no fights. */
  grass?: EncounterTable;
  exits: ExitDef[];
  /** No encounters for this long after a fight. */
  safeTime: number;
}

export function rollEnemy(table: EncounterTable, rng: () => number): EnemyId {
  const total = table.enemies.reduce((s, e) => s + e.weight, 0);
  let r = rng() * total;
  for (const e of table.enemies) if ((r -= e.weight) < 0) return e.enemy;
  return table.enemies[table.enemies.length - 1]!.enemy;
}
