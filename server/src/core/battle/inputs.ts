/**
 * One player's inputs in a fight, as the server takes them: in order, at most one a step (a client can't act faster
 * by sending more). When none is waiting, the last one runs again: that's how a client's idle steps go unsent, and
 * what happens while its inputs are late. `ack` and `repeats` tell the client which: its prediction replays from
 * there (client/src/battle/prediction.ts).
 */
import { IDLE_INPUT, isIdle, type BattleInput, type PlayerInputData } from "@infinite-tower/shared";

/**
 * More inputs than this waiting (they came late, in a bunch), and the oldest are folded into the next one, their
 * presses kept: the player's actions don't lag behind their keys for the rest of the fight.
 */
export const MAX_WAITING_INPUTS = 4;
/**
 * After this many steps with no new input, a player still moving or holding a button is taken to have let go: a
 * client that stalls or lags doesn't keep running in a line. (Idle steps aren't sent, but idle needs no stopping.)
 */
export const INPUT_TIMEOUT_STEPS = 15;

const inputOf = (i: PlayerInputData): PlayerInputData => ({
  moveX: i.moveX, moveZ: i.moveZ, aimX: i.aimX, aimZ: i.aimZ, jump: i.jump, attack: i.attack, dodge: i.dodge,
});

export class InputQueue {
  /** The last input taken. */
  private input: PlayerInputData = { ...IDLE_INPUT };
  private readonly waiting: BattleInput[] = [];
  /** The newest seq that came. */
  private newest = 0;
  /** The seq of the last input taken (0: none yet). */
  ack = 0;
  /** Steps since `ack` that ran it again. */
  repeats = 0;

  /** Whether any input has come: the player is in the arena. */
  get started(): boolean {
    return this.newest > 0;
  }

  /** Inputs that came; one the queue already has, or older than its newest, is ignored. */
  push(inputs: readonly BattleInput[]): void {
    for (const input of inputs) {
      if (input.seq <= this.newest) continue;
      this.newest = input.seq;
      this.waiting.push(input);
    }
  }

  /** The input for the next step. */
  next(): PlayerInputData {
    while (this.waiting.length > MAX_WAITING_INPUTS) {
      const late = this.waiting.shift()!, into = this.waiting[0]!;
      into.jump ||= late.jump;
      into.attack ||= late.attack;
      into.dodge ||= late.dodge;
    }
    const taken = this.waiting.shift();
    if (taken) {
      this.input = inputOf(taken);
      this.ack = taken.seq;
      this.repeats = 0;
    } else if (++this.repeats > INPUT_TIMEOUT_STEPS && !isIdle(this.input)) {
      this.input = { ...IDLE_INPUT, aimX: this.input.aimX, aimZ: this.input.aimZ };
    }
    return this.input;
  }
}
