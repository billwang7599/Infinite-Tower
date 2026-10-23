/** The Grass Field: layout (sent to the client), plus encounter and map-boar rules (never sent). */
import type { FieldLayout, Vec2 } from "@infinite-tower/shared";

export const FIELD: FieldLayout = {
  halfWidth: 20,
  halfDepth: 13,
  border: 1.6,
  playerSpeed: 5,
  spawn: { x: -12, z: -5 },
  grass: { x: 3, z: 1, w: 11, h: 7 },
};

export const ENCOUNTERS = {
  /** Roll for an encounter every this many tiles walked in tall grass... */
  grassStep: 1,
  /** ...with this chance. */
  chance: 0.12,
  /** After a fight, no encounters for this long (seconds). */
  safeTime: 2,
};

export const FIELD_BOAR = {
  start: { x: 8, z: -6 } satisfies Vec2,
  walkSpeed: 1.6,
  chaseSpeed: 3.4,
  /** Starts chasing within this distance. */
  noticeRange: 4.5,
  /** Stands still this long with a "!" before chasing. */
  noticeDelay: 0.5,
  touchRange: 0.9,
  /** A defeated boar is replaced after this many seconds. */
  respawn: 8,
};
