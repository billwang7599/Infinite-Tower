/**
 * A level: everything the server needs to run one area. Only `layout` is sent to the client; spawn
 * points, spawn lists and encounter tables stay here so a player can't read or change them.
 */
import type { ArenaDef, LevelLayout, Vec2 } from "@infinite-tower/shared";
import type { EnemyId } from "../content/enemies.js";
import type { FieldPrefabId } from "../field/prefabs/index.js";

export interface SpawnDef {
  prefab: FieldPrefabId;
  at: Vec2;
  /** Seconds before a defeated one comes back. */
  respawn: number;
}

export interface EncounterTable {
  /** Roll every this many tiles walked in tall grass... */
  step: number;
  /** ...with this chance. */
  chance: number;
  /** Which enemy, by weight. */
  enemies: { enemy: EnemyId; weight: number }[];
}

export interface LevelDef {
  layout: LevelLayout;
  /** Where you appear when you enter, and wake up after losing a fight. */
  spawn: Vec2;
  /** The fight arena for encounters here. */
  arena: ArenaDef;
  /** Field actors, spawned when the level loads and respawned after they are defeated. */
  spawns: SpawnDef[];
  grass: EncounterTable;
  /** After a fight, no encounters for this long (seconds). */
  safeTime: number;
}

/** Pick from a weighted table. */
export function rollEnemy(table: EncounterTable, rng: () => number): EnemyId {
  const total = table.enemies.reduce((s, e) => s + e.weight, 0);
  let r = rng() * total;
  for (const e of table.enemies) if ((r -= e.weight) < 0) return e.enemy;
  return table.enemies[table.enemies.length - 1]!.enemy;
}
