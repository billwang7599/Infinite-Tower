/**
 * A fight as the server runs it, authoritatively: stepped in real time, each player's input on the step it was made
 * for. It runs up to its clock as soon as it knows every player's input for the next step, holding a step back for
 * a late one at most MAX_INPUT_DELAY_STEPS, and never runs ahead of the clock. Built for any number of players.
 */
import {
  HASH_EVERY_STEPS, Health, IDLE_INPUT, MAX_INPUT_DELAY_STEPS, Player, Stamina, type Carried, type Entity,
  type Skillbook, type StepInput, type Vitals,
} from "@infinite-tower/shared";
import { Fight, playerResult, type FightSetup, type PlayerResult } from "@infinite-tower/shared/fight";
import type { PlayerLink } from "../ports.js";
import { InputTimeline } from "./inputs.js";

/** The fight starts once every player has sent their first input (they're in the arena), or after this long. */
export const MAX_START_WAIT_TIME = 5;
/** A player's `battleSync`s are at least this many steps apart: asking more often gets nothing more. */
export const MIN_SYNC_GAP_STEPS = 5;

export interface Seat {
  link: PlayerLink;
  /** Called once, when the fight is over for this player, with the HP, stamina, pages and gear it left them with. */
  onEnd(result: PlayerResult, vitals: Vitals, book: Skillbook, gear: Carried): void;
}

interface SeatState {
  seat: Seat;
  inputs: InputTimeline;
  /** Disconnected. */
  gone: boolean;
  /** The step of the last `battleSync` sent them. */
  syncedAt: number | null;
}

export class BattleRoom {
  readonly fight: Fight;
  private readonly seats: SeatState[];
  /** The clock: steps since the fight started, one a tick. */
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

  /** Player `seat` has run their copy to step `upTo`, with these changes of input on the way. */
  input(seat: number, upTo: number, inputs: readonly StepInput[]): void {
    const s = this.seats[seat];
    if (s && !s.gone && !this.ended) s.inputs.receive(upTo, inputs, this.now);
  }

  /** Player `seat`'s copy differs from the hash: they get the whole fight. */
  resync(seat: number): void {
    const s = this.seats[seat];
    if (!s || s.gone || this.ended || !this.started) return;
    if (s.syncedAt !== null && this.fight.steps - s.syncedAt < MIN_SYNC_GAP_STEPS) return;
    this.sendSync(s);
  }

  /** Player `seat` disconnected: it's over for them now (outcome.ts: LEAVING_LOSES). */
  leave(seat: number): void {
    const s = this.seats[seat];
    if (!s || s.gone || this.ended) return;
    s.gone = true;
    const e = this.fight.players[seat]!;
    const vitals = this.vitalsOf(e);
    this.fight.leave(e);
    const { book, gear } = this.fight.world.require(e, Player);
    s.seat.onEnd(playerResult(this.fight.outcome, true), vitals, book, gear);
    if (this.seats.every((other) => other.gone)) this.close();
  }

  /** One tick of the clock, once everyone is in: the fight runs as far as it can. */
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
      const e = this.fight.players[i]!;
      const { book, gear } = this.fight.world.require(e, Player);
      s.seat.onEnd(playerResult(this.fight.outcome, false), this.vitalsOf(e), book, gear);
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
