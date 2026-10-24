/**
 * Fixed 60 Hz steps from however much time really passed, catching up after a stall (at most 0.25 s of it).
 * The timer that calls `advance` is main.ts's.
 */
import { FIXED_DT } from "@infinite-tower/shared";

const MAX_CATCH_UP = 0.25;

export class FixedClock {
  private acc = 0;

  constructor(private readonly step: (dt: number) => void) {}

  advance(seconds: number): void {
    this.acc += Math.min(MAX_CATCH_UP, seconds);
    while (this.acc >= FIXED_DT) {
      this.step(FIXED_DT);
      this.acc -= FIXED_DT;
    }
  }
}
