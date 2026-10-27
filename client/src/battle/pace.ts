/**
 * The client's fight clock: real time since the fight's first step, so a slow frame runs more steps and a stalled
 * one catches up after. An offset keeps it in step with the server's: each battleHash says how late the client's
 * inputs come, and what the client didn't cause itself (it was behind its own clock) moves the clock ahead (late) or
 * back (early). A correction takes a round trip to show, so news about inputs sent before it is ignored.
 */
import { FIXED_DT } from "@infinite-tower/shared";

/** Late or early by up to this many steps is fine: no correction. */
export const PACE_SLACK_STEPS = 3;
/** Steps a frame at most, catching up. */
export const MAX_STEPS_PER_FRAME = 8;
/** Behind its own clock by more than this (a hidden tab), the rest is dropped; the server's fight is loaded then. */
export const MAX_BACKLOG_STEPS = 30;
/** How many sent inputs' lag is remembered: more than a round trip's worth. */
const KEPT_SENDS = 120;

const STEP_MS = FIXED_DT * 1000;
/** A frame right on a step's edge counts that step (floating point). */
const EDGE_STEPS = 1e-6;

export class Pace {
  /** When the clock's step 0 was (ms), set by the first frame; moved on when a backlog is dropped. */
  private startMs: number | null = null;
  /** Steps the server's reports have moved the clock by. */
  private offset = 0;
  /** The step the client reaches once its last correction is done: what it sent before then is old news. */
  private settledAt = 0;
  /** For each input sent (by its last step), how far behind its own clock the client was. */
  private readonly lagAt = new Map<number, number>();

  /** `now`: as performance.now(). */
  constructor(private readonly now: () => number = () => performance.now()) {}

  /** Steps to run this frame, the fight having run `step`. */
  stepsDue(step: number): number {
    const due = this.due();
    if (due - step > MAX_BACKLOG_STEPS) this.startMs! += (due - step - MAX_BACKLOG_STEPS) * STEP_MS;
    return Math.max(0, Math.min(this.due() - step, MAX_STEPS_PER_FRAME));
  }

  /** The client sent its inputs up to `step`. */
  sent(step: number): void {
    this.lagAt.set(step, this.due() - step);
    if (this.lagAt.size > KEPT_SENDS) this.lagAt.delete(this.lagAt.keys().next().value!);
  }

  /** The server says the input up to `heardStep` came `lateSteps` late; the fight has run `step`. */
  report(lateSteps: number, heardStep: number, step: number): void {
    if (heardStep < this.settledAt) return;
    const off = lateSteps - (this.lagAt.get(heardStep) ?? 0);
    if (Math.abs(off) <= PACE_SLACK_STEPS) return;
    this.offset += off;
    this.settledAt = step + Math.max(off, 0) + 1;
  }

  /** The fight jumped to `step` (it loaded the server's from ahead): the clock goes at least that far. */
  jumped(step: number): void {
    const due = this.due();
    if (due < step) this.offset += step - due;
    this.settledAt = Math.max(this.settledAt, step + 1);
  }

  private due(): number {
    const now = this.now();
    this.startMs ??= now - STEP_MS;
    return Math.floor((now - this.startMs) / STEP_MS + EDGE_STEPS) + this.offset;
  }
}
