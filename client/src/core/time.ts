import type { AbstractEngine } from "@babylonjs/core";

/** A stalled tab's first frame back counts as this long at most, so it doesn't make a huge step. */
const MAX_FRAME_TIME = 0.1;

/** Real seconds since the last rendered frame. */
export function frameSeconds(engine: AbstractEngine): number {
  return Math.min(engine.getDeltaTime() / 1000, MAX_FRAME_TIME);
}
