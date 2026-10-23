/** What field systems get from their session: the current level, randomness, and how to start a fight. */
import type { Entity, Vec2, World } from "@infinite-tower/shared";
import type { EnemyId } from "../content/enemies.js";
import type { LevelDef } from "../levels/level.js";
import { FieldPlayer, FieldPos } from "./components.js";

export interface FieldContext {
  /** Changes when the player moves to another level. */
  readonly level: LevelDef;
  readonly rng: () => number;
  /** Start a fight against `enemy`. `source`: the actor that touched the player, or null (tall grass). */
  encounter(source: Entity | null, enemy: EnemyId): void;
}

/** The player as seen by enemies: where they are and whether they can be engaged right now. */
export function findPrey(world: World): { pos: Vec2; safe: boolean } | null {
  const p = world.first(FieldPlayer, FieldPos);
  return p ? { pos: p[2], safe: p[1].safeTime > 0 } : null;
}
