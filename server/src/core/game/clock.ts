/** Fixed steps from however much time really passed, catching up after a stall (at most 0.25 s of it). */
import { FIXED_DT } from "@infinite-tower/shared";

const MAX_CATCH_UP_TIME = 0.25;

export class FixedClock {
  /** Seconds that have passed but not been stepped yet. */
  private unsteppedTime = 0;

  constructor(private readonly step: (dt: number) => void) {}

  advance(seconds: number): void {
    this.unsteppedTime += Math.min(MAX_CATCH_UP_TIME, seconds);
    while (this.unsteppedTime >= FIXED_DT) {
      this.step(FIXED_DT);
      this.unsteppedTime -= FIXED_DT;
    }
  }
}
