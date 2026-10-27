/**
 * Client-side prediction of your own fighter. Each step: round the input to what goes over the wire, queue it to send
 * (unless it's idle after idle: the server runs the last input again by itself), and step only your fighter with it
 * (Fight.predict), so moving, slashing and dodging answer at once. When the server's `battleState` comes: put your
 * fighter exactly where the server has it, then replay the steps the server hasn't run yet. Same code + same inputs
 * = same result, so normally nothing visibly corrects; a hit the client couldn't know about does. Everyone else is
 * the server's: mirror.ts.
 */
import {
  Body, isIdle, MAX_INPUTS_PER_MESSAGE, quantizeInput, type BattleInput, type ClientMsg, type Entity,
  type PlayerInputData, type ServerMsgOf, type Vec3,
} from "@infinite-tower/shared";
import { writePlayerState, type Fight } from "@infinite-tower/shared/fight";

/** Steps kept for replay at most (10 s): far more than any lag, so only a stalled server ever reaches it. */
const MAX_HISTORY_STEPS = 600;

interface Step {
  seq: number;
  input: PlayerInputData;
  /** Idle after idle isn't sent: the server repeats the last input for it. */
  sent: boolean;
}

export type ServerView = Pick<ServerMsgOf<"battleState">, "ack" | "repeats" | "me">;

export class BattlePrediction {
  private seq = 0;
  /** Your steps the server hasn't confirmed, oldest first. */
  private history: Step[] = [];
  private outbox: BattleInput[] = [];
  private last: PlayerInputData | null = null;
  /** For the current ack: how many unsent idle steps after it the server's repeats have already covered. */
  private ack = 0;
  private covered = 0;
  private stopped = false;

  constructor(
    private readonly fight: Fight,
    private readonly me: Entity,
    private readonly send: (msg: ClientMsg) => void,
  ) {}

  /** One step of your fighter with `input` (from the keys), queued to send. */
  step(raw: PlayerInputData): void {
    const input = quantizeInput(raw);
    if (!this.stopped) {
      const seq = ++this.seq;
      const sent = !(isIdle(input) && this.last !== null && isIdle(this.last));
      if (sent) this.outbox.push({ seq, ...input });
      this.history.push({ seq, input, sent });
      if (this.history.length > MAX_HISTORY_STEPS) this.history.shift();
      this.last = input;
    }
    this.fight.predict(this.me, input);
  }

  /** Sends the inputs queued since the last flush (the battle mode calls it once a frame). */
  flush(): void {
    while (this.outbox.length > 0) {
      this.send({ t: "battleInput", inputs: this.outbox.splice(0, MAX_INPUTS_PER_MESSAGE) });
    }
  }

  /**
   * The server's state: you as it has you after running your input `ack` and then `repeats` more steps with it.
   * Returns how far that moved your fighter from where it was predicted to be (m), for the drawing to ease over.
   */
  reconcile({ ack, repeats, me }: ServerView): Vec3 {
    const pos = this.fight.world.require(this.me, Body).pos;
    const before = { ...pos };
    if (this.stopped) return { x: 0, y: 0, z: 0 };
    if (ack !== this.ack) {
      this.ack = ack;
      this.covered = 0;
    }
    this.history = this.history.filter((s) => s.seq > ack);
    // The server's repeats stand for the idle steps that weren't sent: those are in its state already.
    while (this.covered < repeats && this.history[0] && !this.history[0].sent) {
      this.history.shift();
      this.covered++;
    }
    writePlayerState(this.fight, this.me, me);
    for (const s of this.history) this.fight.predict(this.me, s.input);
    return { x: pos.x - before.x, y: pos.y - before.y, z: pos.z - before.z };
  }

  /** The fight is decided: nothing more is sent or corrected (you can still walk about the arena). */
  stop(): void {
    this.stopped = true;
    this.outbox = [];
    this.history = [];
  }
}
