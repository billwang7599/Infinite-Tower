/**
 * One player's inputs in a fight, by step: up to `upTo` the server knows what they did on every step. A change too
 * late for its step counts on the next one, presses kept. A step run without knowing repeats what the player held;
 * after SILENT_STOP_STEPS of those in a row, their move keys let go (a stalled client doesn't keep running).
 */
import { IDLE_INPUT, MAX_INPUT_LEAD_STEPS, type PlayerInputData, type StepInput } from "@infinite-tower/shared";

export const SILENT_STOP_STEPS = 15;

/** How late a player's inputs reach the server, in steps (negative: early), measured on their input up to a step. */
export interface Lateness { lateSteps: number; heardStep: number }

export class InputTimeline {
  /** The last step the player has said what they did on. */
  private heard = 0;
  /** Changes not run yet, in order. */
  private readonly waiting: StepInput[] = [];
  private newestChange = 0;
  /** What the player holds, as of the last step run. */
  private held: PlayerInputData = { ...IDLE_INPUT };
  private guessed = 0;
  /** The best lateness since `lateness` was last asked for. */
  private best: Lateness | null = null;
  private heardFrom = false;

  /** Anything has come: the player is in the arena. */
  get started(): boolean {
    return this.heardFrom;
  }

  /** A `battleInput` that came at clock `now`. Old changes are ignored, ones too far ahead dropped. */
  receive(upTo: number, inputs: readonly StepInput[], now: number): void {
    this.heardFrom = true;
    const limit = now + MAX_INPUT_LEAD_STEPS;
    for (const input of inputs) {
      if (input.step <= this.newestChange || input.step > limit) continue;
      this.newestChange = input.step;
      this.waiting.push(input);
    }
    this.heard = Math.max(this.heard, Math.min(upTo, limit));
    // The clock's next step is now + 1: an input for it, here now, is just in time.
    const lateSteps = now + 1 - upTo;
    if (!this.best || lateSteps < this.best.lateSteps) this.best = { lateSteps, heardStep: upTo };
  }

  known(step: number): boolean {
    return step <= this.heard;
  }

  /**
   * The input for `step`, the fight's next. Of the changes too late for their own steps, the first with a button down
   * runs as it was made (a dodge goes where it was aimed), with every button pressed in any of them held down.
   */
  take(step: number): PlayerInputData {
    let late: PlayerInputData | null = null;
    const pressed: Pick<PlayerInputData, "jump" | "attack" | "dodge" | "block" | "cast"> =
      { jump: false, attack: null, dodge: false, block: false, cast: null };
    while (this.waiting[0] && this.waiting[0].step <= step) {
      const { step: madeFor, ...change } = this.waiting.shift()!;
      if (madeFor < step) {
        const anyPress = change.jump || change.attack !== null || change.dodge || change.cast !== null;
        if (!late && anyPress) late = change;
        pressed.jump ||= change.jump;
        pressed.attack ??= change.attack;
        pressed.dodge ||= change.dodge;
        pressed.block ||= change.block;
        pressed.cast ??= change.cast;
      }
      this.held = change;
    }
    const base = late ?? this.held;
    const input = {
      ...base, jump: this.held.jump || pressed.jump, attack: this.held.attack ?? pressed.attack,
      dodge: this.held.dodge || pressed.dodge, block: this.held.block || pressed.block,
      cast: this.held.cast ?? pressed.cast, castHeld: this.held.castHeld,
    };
    if (this.known(step)) {
      this.guessed = 0;
      return input;
    }
    return ++this.guessed > SILENT_STOP_STEPS ? { ...input, moveX: 0, moveZ: 0 } : input;
  }

  /** The best lateness since this was last asked, or with none, how long the player has been silent. */
  lateness(now: number): Lateness {
    const found = this.best ?? { lateSteps: now - this.heard, heardStep: this.heard };
    this.best = null;
    return found;
  }
}
