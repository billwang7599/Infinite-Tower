/**
 * Overworld (2D top-down map). Units are tiles; +z is up on screen, +x is right.
 * The field spans x ∈ [-halfWidth, halfWidth], z ∈ [-halfDepth, halfDepth]; a tree border sits on the edge.
 */
export const MAP = {
  halfWidth: 20,
  halfDepth: 13,
  /** Walkable area stops this far inside the edge (the tree border). */
  border: 1.6,
  playerSpeed: 5,
  spawn: { x: -12, z: -5 },
  /** Tall grass patch (min corner + size). */
  grass: { x: 3, z: 1, w: 11, h: 7 },
  /** Roll for an encounter every this many tiles walked in tall grass... */
  grassStep: 1,
  /** ...with this chance. */
  encounterChance: 0.12,
  /** After a fight, no encounters for this long. */
  safeTime: 2,
  boar: {
    walkSpeed: 1.6,
    chaseSpeed: 3.4,
    /** Starts chasing within this distance. */
    noticeRange: 4.5,
    /** Stands still this long with a "!" before chasing. */
    noticeDelay: 0.5,
    touchRange: 0.9,
    /** A defeated boar is replaced after this many seconds. */
    respawn: 8,
  },
} as const;
