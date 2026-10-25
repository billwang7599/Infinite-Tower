/** What field systems get from their field: the current level, randomness, and how to start a battle. */
import type { Entity } from "@infinite-tower/shared";
import type { EnemyId } from "../content/enemies.js";
import type { LevelDef } from "../levels/level.js";

export interface FieldContext {
  /** Changes when the player moves to another level. */
  readonly level: LevelDef;
  readonly rng: () => number;
  /** Start a battle against `enemy`. `source`: the actor that touched the player, or null (tall grass). */
  startEncounter(source: Entity | null, enemy: EnemyId): void;
}
