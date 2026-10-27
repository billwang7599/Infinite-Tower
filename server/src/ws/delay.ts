/** Holds each callback `delayMs` before running it, in the order they came: the dev server's simulated ping. */
export class DelayLine {
  private readonly waiting: (() => void)[] = [];

  /** `delayMs` may have a half (an odd ping split both ways); 0 runs everything at once. */
  constructor(private readonly delayMs: number) {}

  push(run: () => void): void {
    if (this.delayMs <= 0) {
      run();
      return;
    }
    this.waiting.push(run);
    // Each timer runs whatever is first in line, not its own callback: however the timers fire, the order holds.
    setTimeout(() => this.waiting.shift()?.(), this.delayMs);
  }
}
