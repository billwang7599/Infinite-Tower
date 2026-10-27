/**
 * A fight, as the server runs it: the shared Fight, stepped in real time with each player's inputs, each on the step
 * it was made for (inputs.ts). The room keeps a clock (`now`: steps since the fight started, one a tick) and runs
 * the fight up to it as soon as it knows every player's input for the next step. It holds a step back for a late
 * input for at most MAX_INPUT_DELAY_STEPS, then runs it without (the input counts on the next step when it comes),
 * and it never runs ahead of its clock, whatever a client says. Every HASH_EVERY_STEPS-th step it sends everyone the
 * fight's hash; a client whose copy differs asks for the whole fight (`resync`). It's authoritative: hits, damage,
 * stamina, deaths and the result are all the server's. Built for any number of players; every battle has one for
 * now, and that player's session ticks it (game/session.ts).
 */
import {
  HASH_EVERY_STEPS, Health, IDLE_INPUT, MAX_INPUT_DELAY_STEPS, Stamina, type Entity, type StepInput, type Vitals,
} from "@infinite-tower/shared";
import { Fight, playerResult, type FightSetup, type PlayerResult } from "@infinite-tower/shared/fight";
import type { PlayerLink } from "../ports.js";
import { InputTimeline } from "./inputs.js";

/**
 * The fight starts once every player has sent their first input (they've flashed into the arena and can see it), or
 * after this many seconds, whichever is first.
 */
export const MAX_START_WAIT_TIME = 5;
/** A player's `battleSync`s are at least this many steps apart: asking more often gets nothing more. */
export const MIN_SYNC_GAP_STEPS = 5;

/** A player in the room. */
export interface Seat {
  link: PlayerLink;
  /**
   * Called once, when the fight is over for this player: won, lost, or "left" (gone, with nothing won or lost; only
   * without LEAVING_LOSES). `vitals`: the HP and stamina it left them with.
   */
  onEnd(result: PlayerResult, vitals: Vitals): void;
}

interface SeatState {
  seat: Seat;
  inputs: InputTimeline;
  /** Disconnected: out of the fight. */
  gone: boolean;
  /** The step of the last `battleSync` sent them. */
  syncedAt: number | null;
}

export class BattleRoom {
  readonly fight: Fight;
  private readonly seats: SeatState[];
  /** Steps since the fight started, one a tick: the fight never runs past it. */
  private now = 0;
  private waitedTime = 0;
  private started = false;
  private ended = false;

  /** `seats[i]` plays `setup.players[i]`. Needs initPhysics() to have finished. */
  constructor(setup: FightSetup, seats: Seat[]) {
    this.fight = new Fight(setup);
    this.seats = seats.map((seat) => ({ seat, inputs: new InputTimeline(), gone: false, syncedAt: null }));
  }

  /** Over for everyone, and freed. */
  get over(): boolean {
    return this.ended;
  }

  /** Player `seat` has run their fight to step `upTo`, with these changes of input on the way. */
  input(seat: number, upTo: number, inputs: readonly StepInput[]): void {
    const s = this.seats[seat];
    if (s && !s.gone && !this.ended) s.inputs.receive(upTo, inputs, this.now);
  }

  /** Player `seat`'s copy differs from the hash: they get the whole fight, as it is now. */
  resync(seat: number): void {
    const s = this.seats[seat];
    if (!s || s.gone || this.ended || !this.started) return;
    if (s.syncedAt !== null && this.fight.steps - s.syncedAt < MIN_SYNC_GAP_STEPS) return;
    this.sendSync(s);
  }

  /** Player `seat` disconnected: they're out of the fight, and it's over for them now (outcome.ts: LEAVING_LOSES). */
  leave(seat: number): void {
    const s = this.seats[seat];
    if (!s || s.gone || this.ended) return;
    s.gone = true;
    const e = this.fight.players[seat]!;
    const vitals = this.vitalsOf(e);
    this.fight.leave(e);
    s.seat.onEnd(playerResult(this.fight.outcome, true), vitals);
    if (this.seats.every((other) => other.gone)) this.close();
  }

  /** One tick of the clock (FIXED_DT), once everyone is in: the fight runs as far as it can. */
  tick(): void {
    if (this.ended || !this.ready()) return;
    this.now++;
    while (!this.ended && this.fight.steps < this.now) {
      const next = this.fight.steps + 1;
      const overdue = this.now - next >= MAX_INPUT_DELAY_STEPS;
      if (!overdue && !this.seats.every((s) => s.gone || s.inputs.known(next))) break;
      this.runStep(next);
    }
  }

  private runStep(step: number): void {
    this.fight.step(this.seats.map((s) => (s.gone ? IDLE_INPUT : s.inputs.take(step))));
    if (this.fight.outcome.state !== "fighting") this.finish();
    else if (step % HASH_EVERY_STEPS === 0) this.sendHash();
  }

  private ready(): boolean {
    if (this.started) return true;
    this.waitedTime += Fight.STEP_SECONDS;
    this.started = this.seats.every((s) => s.gone || s.inputs.started) || this.waitedTime >= MAX_START_WAIT_TIME;
    return this.started;
  }

  private sendHash(): void {
    const hash = this.fight.hash();
    for (const s of this.seats) {
      if (!s.gone) s.seat.link.send({ t: "battleHash", step: this.fight.steps, hash, ...s.inputs.lateness(this.now) });
    }
  }

  private sendSync(s: SeatState): void {
    s.syncedAt = this.fight.steps;
    s.seat.link.send({
      t: "battleSync", step: this.fight.steps, fight: this.fight.save(), ...s.inputs.lateness(this.now),
    });
  }

  /** Decided: everyone still here gets the fight as it ended (their copy may differ), then their result. */
  private finish(): void {
    this.seats.forEach((s, i) => {
      if (s.gone) return;
      this.sendSync(s);
      s.seat.onEnd(playerResult(this.fight.outcome, false), this.vitalsOf(this.fight.players[i]!));
    });
    this.close();
  }

  private vitalsOf(e: Entity): Vitals {
    return { hp: this.fight.world.require(e, Health).hp, stamina: this.fight.world.require(e, Stamina).value };
  }

  private close(): void {
    this.ended = true;
    this.fight.dispose();
  }
}
