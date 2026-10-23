import type { Engine } from "@babylonjs/core";

/** Real seconds since the last rendered frame, capped so a stalled tab doesn't make a huge step. */
export function frameSeconds(engine: Engine): number {
  return Math.min(engine.getDeltaTime() / 1000, 0.1);
}
