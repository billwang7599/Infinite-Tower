import type { EnemyId, Entity } from "@infinite-tower/shared";
import type { LevelDef } from "../world/level.js";

export interface OverworldContext {
  readonly level: LevelDef;
  readonly rng: () => number;
  /** Start `player`'s battle against `enemy`. `source`: the actor that touched them, or null (tall grass). */
  startEncounter(player: Entity, source: Entity | null, enemy: EnemyId): void;
}
