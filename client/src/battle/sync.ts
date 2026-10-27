/**
 * The client's own copy of the fight, run whole and at once: you, the enemies, hits and all, so what you see answers
 * your keys on the next step. Each step it runs the fight with your input (rounded as the wire rounds it), and
 * queues the input to send if it changed, tagged with its step; `upTo` tells the server how far this copy has run,
 * so it knows nothing changed until then. The server runs the same fight on the same inputs at the same steps, and
 * four times a second its hash (battleHash) is checked against this copy's at that step. When they differ (an input
 * reached the server too late for its step, or another machine's maths drifted), the client asks for the server's
 * fight (battleResync), loads it (battleSync) and replays its own inputs since. The result is only ever the
 * server's: `outcome` stays "fighting" until battleResult comes, whatever this copy says.
 */
import {
  copyInput, FIXED_DT, HASH_EVERY_STEPS, Health, MAX_INPUT_DELAY_STEPS, MAX_INPUTS_PER_MESSAGE, Player, PlayerInput,
  quantizeInput, sameInput, type ClientMsg, type Entity, type PlayerInputData, type ServerMsgOf, type StepInput,
} from "@infinite-tower/shared";
import type { Fight, FightOutcome } from "@infinite-tower/shared/fight";
import { Pace } from "./pace.js";

/** With nothing new to send, the client still says how far it has got this often (steps). */
export const INPUT_HEARTBEAT_STEPS = 3;
/** Steps of inputs and hashes kept, to check against and to replay (1 s): more than a round trip. */
export const HISTORY_STEPS = 60;
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

export class FightSync {
  /** How the fight stands as the server says: the result banner waits for it. */
  readonly outcome: FightOutcome = { state: "fighting", stateTime: 0 };
  readonly stats: SyncStats = {
    checks: 0, mismatches: 0, restores: 0, corrections: 0, hiddenHits: 0, hiddenDodgeHits: 0,
  };
  /** The fight's clock: how many steps to run each frame, in step with the server's. */
  readonly pace: Pace;
  /** Your input on each recent step, oldest first, one per step. */
  private history: StepInput[] = [];
  /** This copy's hash after each recent HASH_EVERY_STEPS-th step. */
  private readonly hashes = new Map<number, number>();
  /** The server's hashes for steps this copy hasn't run yet. */
  private readonly ahead = new Map<number, number>();
  private outbox: StepInput[] = [];
  /** The last change queued, and the last one sent. */
  private queued: PlayerInputData | null = null;
  private sent: PlayerInputData | null = null;
  private sentUpTo = 0;
  /** The step the server's fight was asked for at, until it comes. */
  private askedAt: number | null = null;
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
  }

  private get me(): Entity {
    return this.fight.players[this.seat]!;
  }

  /** One step of the fight, with your input (from the keys). Its events are the fight's `events` until the next. */
  advance(raw: PlayerInputData): void {
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

  /** Sends the changes queued since the last flush, and how far the fight has run (once a frame). */
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

  /** The server's hash after `step`: checked against this copy's (now, or once this copy gets there). */
  onHash({ step, hash, lateSteps, heardStep }: ServerMsgOf<"battleHash">): void {
    if (this.decided) return;
    this.pace.report(lateSteps, heardStep, this.fight.steps);
    if (step <= this.fight.steps) {
      const mine = this.hashes.get(step);
      if (mine !== undefined) this.check(mine, hash);
    } else if (step - this.fight.steps > MAX_INPUT_DELAY_STEPS) {
      // Far behind the server's fight: it has run those steps without your inputs. Take its fight instead.
      this.ask();
    } else {
      this.ahead.set(step, hash);
    }
  }

  /** The server's whole fight after `step`: loaded, then your inputs since are replayed on it. */
  onSync({ step, fight, lateSteps, heardStep }: ServerMsgOf<"battleSync">): void {
    if (this.decided) return;
    this.askedAt = null;
    const present = this.fight.steps;
    const hashBefore = this.fight.hash(), hpBefore = this.hp();
    this.fight.load(fight);
    this.hashes.clear();
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

  /** The server's result (battleResult): the fight is over, and the banner may show. */
  onResult(won: boolean): void {
    const state = won ? "won" : "lost";
    this.decided = true;
    this.outbox = [];
    this.ahead.clear();
    // Timed from the step this copy was decided on, if it agrees: the banner shows as long after that as ever.
    const stateTime = this.fight.outcome.state === state ? this.fight.outcome.stateTime : 0;
    Object.assign(this.outcome, { state, stateTime });
  }

  /** Runs steps `from`..`to` again with your inputs on them (your held input where none is kept). */
  private replay(from: number, to: number): void {
    const first = this.history[0]?.step ?? Infinity;
    for (let step = from; step <= to; step++) {
      const kept = step >= first ? this.history[step - first] : undefined;
      this.run(copyInput(kept ?? this.fight.world.require(this.me, PlayerInput)));
    }
  }

  /** The fight's next step: your input, everyone else's last; the hash taken if it's a step the server checks. */
  private run(input: PlayerInputData): void {
    const inputs: PlayerInputData[] = [];
    inputs[this.seat] = input;
    this.fight.step(inputs);
    const step = this.fight.steps;
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

  private hp(): number {
    return this.fight.world.require(this.me, Health).hp;
  }
}
