/**
 * The client's own copy of the fight, run whole and at once so it answers your keys on the next step. It sends each
 * change of input with its step, checks the server's hashes against its own, and on a mismatch loads the server's
 * fight and replays its inputs since. The result is only ever the server's: `outcome` waits for battleResult.
 */
import {
  copyInput, FIXED_DT, HASH_EVERY_STEPS, Health, MAX_INPUT_DELAY_STEPS, MAX_INPUTS_PER_MESSAGE, Player, PlayerInput,
  quantizeInput, sameInput, type ClientMsg, type Entity, type PlayerInputData, type ServerMsgOf, type StepInput,
} from "@infinite-tower/shared";
import type { Fight, FightEvent, FightOutcome, FightSnapshot, PlayerSetup } from "@infinite-tower/shared/fight";
import { Pace } from "./pace.js";

/** With nothing new to send, the client still says how far it has got this often (steps). */
export const INPUT_HEARTBEAT_STEPS = 3;
/** Steps of inputs and hashes kept, to check against and to replay (1 s): more than a round trip. */
const HISTORY_STEPS = 60;
/** Asked for the server's fight and none came in this many steps: ask again. */
const RESYNC_RETRY_STEPS = 60;
/** A hit only the server saw counts as one through a dodge you were shown if the dodge started this recently. */
const DODGE_LOOKBACK_STEPS = 45;

export interface SyncStats {
  /** Hashes compared, and how many differed. */
  checks: number;
  mismatches: number;
  /** Server fights loaded, and how many of them changed anything. */
  restores: number;
  corrections: number;
  /** Loads that took HP from you: hits you hadn't been shown; and of those, hits just after a dodge you were shown. */
  hiddenHits: number;
  hiddenDodgeHits: number;
}

export interface StepEvent { step: number; event: FightEvent }

export class FightSync {
  /** As the server says. */
  readonly outcome: FightOutcome = { state: "fighting", stateTime: 0 };
  /** Every step's events as it runs, replays included, until taken. */
  readonly events: StepEvent[] = [];
  readonly stats: SyncStats = {
    checks: 0, mismatches: 0, restores: 0, corrections: 0, hiddenHits: 0, hiddenDodgeHits: 0,
  };
  readonly pace: Pace;
  /** Your input on each recent step, oldest first, one per step. */
  private history: StepInput[] = [];
  /** This copy's hash after each recent HASH_EVERY_STEPS-th step. */
  private readonly hashes = new Map<number, number>();
  /** The server's hashes for steps this copy hasn't run yet. */
  private readonly ahead = new Map<number, number>();
  private readonly theirs = new Map<number, PlayerInputData[]>();
  /** With other players: this copy after each recent step, to go back to when their inputs come. */
  private readonly states = new Map<number, FightSnapshot>();
  private outbox: StepInput[] = [];
  /** The last change queued, and the last one sent. */
  private queued: PlayerInputData | null = null;
  private sent: PlayerInputData | null = null;
  private sentUpTo = 0;
  /** The step the server's fight was asked for at, until it comes. */
  private askedAt: number | null = null;
  private behind = false;
  private lastDodgeStep = -Infinity;
  /** The server's result has come: nothing more is sent or checked. */
  private decided = false;

  /** `seat`: which of the fight's players you are. `now`: milliseconds, as performance.now(). */
  constructor(
    readonly fight: Fight,
    private readonly seat: number,
    private readonly send: (msg: ClientMsg) => void,
    now: () => number = () => performance.now(),
  ) {
    this.pace = new Pace(now);
    this.keepState();
  }

  private get me(): Entity {
    return this.fight.players[this.seat]!;
  }

  /** One step, with your input. Its events are the fight's `events` until the next. */
  advance(raw: PlayerInputData): void {
    if (this.behind && !this.decided) this.ask();
    this.behind = false;
    const input = quantizeInput(raw);
    const step = this.fight.steps + 1;
    this.history.push({ step, ...input });
    if (this.history.length > HISTORY_STEPS) this.history.shift();
    if (!this.decided && (!this.queued || !sameInput(this.queued, input))) {
      this.outbox.push({ step, ...input });
      this.queued = input;
    }
    this.run(input);
    const player = this.fight.world.require(this.me, Player);
    if (player.action === "dodge" && player.actionTime <= FIXED_DT * 1.5) this.lastDodgeStep = step;
    if (this.outcome.state !== "fighting") this.outcome.stateTime += FIXED_DT;
  }

  /** Once a frame: the changes queued since the last flush, and how far the fight has run. */
  flush(): void {
    const upTo = this.fight.steps;
    if (this.decided || (this.outbox.length === 0 && upTo - this.sentUpTo < INPUT_HEARTBEAT_STEPS)) return;
    while (this.outbox.length > MAX_INPUTS_PER_MESSAGE) {
      const inputs = this.outbox.splice(0, MAX_INPUTS_PER_MESSAGE);
      this.send({ t: "battleInput", upTo: inputs.at(-1)!.step, inputs });
    }
    this.send({ t: "battleInput", upTo, inputs: this.outbox.splice(0) });
    this.sent = this.queued;
    this.sentUpTo = upTo;
    this.pace.sent(upTo);
  }

  /** Checked against this copy's hash at `step`, now or once this copy gets there. */
  onHash({ step, hash, lateSteps, heardStep }: ServerMsgOf<"battleHash">): void {
    if (this.decided) return;
    this.pace.report(lateSteps, heardStep, this.fight.steps);
    if (step <= this.fight.steps) {
      const mine = this.hashes.get(step);
      if (mine !== undefined) this.check(mine, hash);
    } else if (step - this.fight.steps > MAX_INPUT_DELAY_STEPS) {
      // Far behind the server's fight: take its fight once this copy runs again (stalled, it couldn't use one yet).
      this.behind = true;
    } else {
      this.ahead.set(step, hash);
    }
  }

  /** Loads the server's fight, then replays your inputs since on it. */
  onSync({ step, fight, lateSteps, heardStep }: ServerMsgOf<"battleSync">): void {
    if (this.decided) return;
    this.askedAt = null;
    this.behind = false;
    const present = this.fight.steps;
    const hashBefore = this.fight.hash(), hpBefore = this.hp();
    this.fight.load(fight);
    this.hashes.clear();
    this.states.clear();
    this.keepState();
    for (const at of this.ahead.keys()) if (at <= step) this.ahead.delete(at);
    if (step % HASH_EVERY_STEPS === 0) this.hashes.set(step, this.fight.hash());
    if (step >= present) {
      // You were behind the server's fight: you're where it is now. What you hadn't sent is for steps long run.
      this.history = [];
      this.outbox = [];
      this.queued = this.sent;
      this.pace.jumped(step);
    } else {
      this.replay(step + 1, present);
    }
    this.pace.report(lateSteps, heardStep, this.fight.steps);
    this.stats.restores++;
    if (this.fight.hash() === hashBefore) return;
    this.stats.corrections++;
    if (this.hp() >= hpBefore) return;
    this.stats.hiddenHits++;
    if (this.lastDodgeStep >= present - DODGE_LOOKBACK_STEPS) this.stats.hiddenDodgeHits++;
  }

  onInputs({ inputs }: ServerMsgOf<"battleInputs">): void {
    if (this.decided) return;
    let from = Infinity;
    for (const { seat, changes } of inputs) {
      if (seat === this.seat) continue;
      for (const { step, ...change } of changes) {
        let known = this.theirs.get(step);
        if (!known) this.theirs.set(step, known = []);
        known[seat] = change;
        from = Math.min(from, step);
      }
    }
    if (from > this.fight.steps) return;
    const before = this.states.get(from - 1);
    if (!before) {
      this.ask();
      return;
    }
    const present = this.fight.steps;
    this.fight.load(before);
    this.replay(from, present);
  }

  onJoined(player: PlayerSetup): void {
    if (this.decided) return;
    this.fight.join(player);
    this.states.clear();
    this.hashes.clear();
    this.ahead.clear();
  }

  /** battleResult: the fight is over, and the banner may show. */
  onResult(won: boolean): void {
    const state = won ? "won" : "lost";
    this.decided = true;
    this.outbox = [];
    this.ahead.clear();
    // Timed from the step this copy was decided on, if it agrees: the banner shows as long after that as ever.
    const stateTime = this.fight.outcome.state === state ? this.fight.outcome.stateTime : 0;
    Object.assign(this.outcome, { state, stateTime });
  }

  /** Steps `from`..`to` again with your inputs (your held input where none is kept). */
  private replay(from: number, to: number): void {
    const first = this.history[0]?.step ?? Infinity;
    for (let step = from; step <= to; step++) {
      const kept = step >= first ? this.history[step - first] : undefined;
      this.run(copyInput(kept ?? this.fight.world.require(this.me, PlayerInput)));
    }
  }

  /** Your input, the others' as the server ran them or else their last; the hash taken if the server checks it. */
  private run(input: PlayerInputData): void {
    const inputs = [...this.theirs.get(this.fight.steps + 1) ?? []];
    inputs[this.seat] = input;
    this.fight.step(inputs);
    const step = this.fight.steps;
    this.keepState();
    this.states.delete(step - HISTORY_STEPS - 1);
    this.theirs.delete(step - HISTORY_STEPS - 1);
    for (const event of this.fight.events) this.events.push({ step, event });
    if (step % HASH_EVERY_STEPS !== 0) return;
    const hash = this.fight.hash();
    this.hashes.set(step, hash);
    this.hashes.delete(step - HISTORY_STEPS - HASH_EVERY_STEPS);
    const theirs = this.ahead.get(step);
    if (theirs === undefined) return;
    this.ahead.delete(step);
    this.check(hash, theirs);
  }

  private check(mine: number, theirs: number): void {
    this.stats.checks++;
    if (mine === theirs) return;
    this.stats.mismatches++;
    this.ask();
  }

  private ask(): void {
    if (this.askedAt !== null && this.fight.steps - this.askedAt < RESYNC_RETRY_STEPS) return;
    this.askedAt = this.fight.steps;
    this.send({ t: "battleResync" });
  }

  private keepState(): void {
    if (this.fight.players.length > 1) this.states.set(this.fight.steps, this.fight.save());
  }

  private hp(): number {
    return this.fight.world.require(this.me, Health).hp;
  }
}
