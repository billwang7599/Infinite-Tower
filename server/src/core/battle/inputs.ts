/**
 * One player's inputs in a fight, as the server takes them. The client sends each change of input with the step it's
 * for, and `upTo`, the last step its own fight has run: so up to there the server knows exactly what the player did
 * on every step (the last change holds until the next) and runs it on that step. What comes too late for its step
 * (the room has run it already: see room.ts) counts on the next step instead, presses kept, and the client is
 * corrected. A step the server has to run without knowing repeats what the player held; after SILENT_STOP_STEPS of
 * those in a row, the player is taken to have let go of the move keys (a client that stalls doesn't keep running).
 */
import { IDLE_INPUT, MAX_INPUT_LEAD_STEPS, type PlayerInputData, type StepInput } from "@infinite-tower/shared";

/** Steps run in a row without the player's input before they're taken to have stopped moving. */
export const SILENT_STOP_STEPS = 15;

/** How late a player's inputs reach the server, in steps (negative: early), measured on their input up to a step. */
export interface Lateness { lateSteps: number; heardStep: number }

export class InputTimeline {
  /** The last step the player has said what they did on. */
  private heard = 0;
  /** Changes not run yet, in step order. */
  private readonly waiting: StepInput[] = [];
  private newestChange = 0;
  /** What the player holds, as of the last step run. */
  private held: PlayerInputData = { ...IDLE_INPUT };
  /** Steps run in a row without knowing the player's input. */
  private guessed = 0;
  /** The best lateness since `lateness` was last asked for. */
  private best: Lateness | null = null;
  private heardFrom = false;

  /** Whether anything has come: the player is in the arena. */
  get started(): boolean {
    return this.heardFrom;
  }

  /**
   * A `battleInput` that came while the room's clock was at `now`. A change it has already, or for a step it has
   * had a later change for, is ignored; one more than MAX_INPUT_LEAD_STEPS ahead of the clock is dropped.
   */
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

  /** Whether the player has said what they did on `step`. */
  known(step: number): boolean {
    return step <= this.heard;
  }

  /**
   * The input to run on `step`, the fight's next. Changes too late for their own steps count on this one: the first
   * of them with a button down as it was made (a dodge goes where it was aimed), every button pressed in any of them
   * held down for this step; the step after runs what the player holds now.
   */
  take(step: number): PlayerInputData {
    let late: PlayerInputData | null = null;
    const pressed: Pick<PlayerInputData, "jump" | "attack" | "dodge" | "block"> =
      { jump: false, attack: null, dodge: false, block: false };
    while (this.waiting[0] && this.waiting[0].step <= step) {
      const { step: madeFor, ...change } = this.waiting.shift()!;
      if (madeFor < step) {
        if (!late && (change.jump || change.attack !== null || change.dodge)) late = change;
        pressed.jump ||= change.jump;
        pressed.attack ??= change.attack;
        pressed.dodge ||= change.dodge;
        pressed.block ||= change.block;
      }
      this.held = change;
    }
    const base = late ?? this.held;
    const input = {
      ...base, jump: this.held.jump || pressed.jump, attack: this.held.attack ?? pressed.attack,
      dodge: this.held.dodge || pressed.dodge, block: this.held.block || pressed.block,
    };
    if (this.known(step)) {
      this.guessed = 0;
      return input;
    }
    return ++this.guessed > SILENT_STOP_STEPS ? { ...input, moveX: 0, moveZ: 0 } : input;
  }

  /** How late the player's inputs have come since this was last asked (at clock `now`): the best of them, or, with
   * none, how long the player has been silent. */
  lateness(now: number): Lateness {
    const found = this.best ?? { lateSteps: now - this.heard, heardStep: this.heard };
    this.best = null;
    return found;
  }
}
