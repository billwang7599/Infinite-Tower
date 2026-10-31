/**
 * One player's inputs in a fight, by step: up to `upTo` the server knows what they did on every step. A change too
 * late for its step counts on the next one, presses kept. A step run without knowing repeats what the player held;
 * after SILENT_STOP_STEPS of those in a row, their move keys let go (a stalled client doesn't keep running).
 */
import { IDLE_INPUT, MAX_INPUT_LEAD_STEPS, type PlayerInputData, type StepInput } from "@infinite-tower/shared";

export const SILENT_STOP_STEPS = 15;

type Presses = Pick<PlayerInputData, "jump" | "attack" | "dodge" | "kick" | "cast" | "chantWords" | "use">;
const NO_PRESSES: Presses =
  { jump: false, attack: null, dodge: false, kick: false, cast: null, chantWords: null, use: null };

/** How late a player's inputs reach the server, in steps (negative: early), measured on their input up to a step. */
export interface Lateness { lateSteps: number; heardStep: number }

export class InputTimeline {
  /** Changes for steps not run yet, in order: one a step at most, up to MAX_INPUT_LEAD_STEPS past the clock. */
  private readonly waiting: StepInput[] = [];
  private late: PlayerInputData | null = null;
  private pressed: Presses = { ...NO_PRESSES };
  private newestChange = 0;
  private ranStep: number;
  /** What the player holds, as of the last step run. */
  private held: PlayerInputData = { ...IDLE_INPUT };
  private guessed = 0;
  /** The best lateness since `lateness` was last asked for. */
  private best: Lateness | null = null;
  private heardFrom = false;

  /** A joiner's `heard` is the step they came in after. */
  constructor(private heard = 0) {
    this.ranStep = heard;
  }

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
      if (input.step > this.ranStep) this.waiting.push(input);
      else this.fold(input);
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
    this.ranStep = step;
    while (this.waiting[0] && this.waiting[0].step <= step) {
      const { step: _madeFor, ...change } = this.waiting.shift()!;
      this.held = change;
    }
    const { held, pressed } = this;
    const input = {
      ...(this.late ?? held), jump: held.jump || pressed.jump, attack: held.attack ?? pressed.attack,
      dodge: held.dodge || pressed.dodge, kick: held.kick || pressed.kick,
      cast: held.cast ?? pressed.cast, castHeld: held.castHeld,
      chantWords: held.chantWords ?? pressed.chantWords, use: held.use ?? pressed.use,
    };
    this.late = null;
    this.pressed = { ...NO_PRESSES };
    if (this.known(step)) {
      this.guessed = 0;
      return input;
    }
    return ++this.guessed > SILENT_STOP_STEPS ? { ...input, moveX: 0, moveZ: 0 } : input;
  }

  private fold({ step: _madeFor, ...change }: StepInput): void {
    const anyPress = change.jump || change.attack !== null || change.dodge || change.kick
      || change.cast !== null;
    if (!this.late && anyPress) this.late = change;
    const pressed = this.pressed;
    pressed.jump ||= change.jump;
    pressed.attack ??= change.attack;
    pressed.dodge ||= change.dodge;
    pressed.kick ||= change.kick;
    pressed.cast ??= change.cast;
    pressed.chantWords = change.chantWords ?? pressed.chantWords;
    pressed.use ??= change.use;
    this.held = change;
  }

  /** The best lateness since this was last asked, or with none, how long the player has been silent. */
  lateness(now: number): Lateness {
    const found = this.best ?? { lateSteps: now - this.heard, heardStep: this.heard };
    this.best = null;
    return found;
  }
}
