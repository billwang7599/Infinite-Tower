/**
 * A fight as the server runs it, authoritatively: stepped in real time, each player's input on the step it was made
 * for. It runs up to its clock as soon as it knows every player's input for the next step, holding a step back for
 * a late one at most MAX_INPUT_DELAY_STEPS, and never runs ahead of the clock. Built for any number of players.
 * Won against enemies, it runs on for the winners still in the arena (to walk to the drops) until the last leaves.
 */
import {
  HASH_EVERY_STEPS, Health, IDLE_INPUT, MAX_INPUT_DELAY_STEPS, Player, sameInput, Stamina, type Carried, type Entity,
  type PlayerInputData, type Skillbook, type StepInput, type Vitals, type World,
} from "@infinite-tower/shared";
import {
  Fight, joinStart, playerResult, type FightSetup, type PlayerResult, type PlayerSetup,
} from "@infinite-tower/shared/fight";
import type { PlayerLink } from "../ports.js";
import { InputTimeline } from "./inputs.js";

/** The fight starts once every player has sent their first input (they're in the arena), or after this long. */
export const MAX_START_WAIT_TIME = 5;
/** A player's `battleSync`s are at least this many steps apart: asking more often gets nothing more. */
export const MIN_SYNC_GAP_STEPS = 5;
/** Still in it at once, joiners included. */
export const MAX_BATTLE_PLAYERS = 4;

export interface Seat {
  link: PlayerLink;
  /** Called once, when the fight is over for this player, with the HP, stamina, pages and gear it left them with. */
  onEnd(result: PlayerResult, vitals: Vitals, book: Skillbook, gear: Carried): void;
}

export interface RoomHooks {
  /** Decided, or everyone gone before it was. */
  onOver?: () => void;
  onClosed?: () => void;
}

interface SeatState {
  seat: Seat;
  inputs: InputTimeline;
  /** Out of the arena: disconnected, left it, or out of the fight with a result that doesn't keep them there. */
  gone: boolean;
  /** The step of the last `battleSync` sent them. */
  syncedAt: number | null;
  ran: PlayerInputData;
  unrelayed: StepInput[];
}

const seated = (seat: Seat, from = 0): SeatState => ({
  seat, inputs: new InputTimeline(from), gone: false, syncedAt: null, ran: IDLE_INPUT, unrelayed: [],
});

export class BattleRoom {
  readonly fight: Fight;
  private readonly seats: SeatState[];
  private readonly players: PlayerSetup[];
  /** The clock: steps since the fight started, one a tick. */
  private now = 0;
  private waitedTime = 0;
  private started = false;
  private decided = false;
  private ended = false;

  /** `seats[i]` plays `setup.players[i]`. Needs initPhysics() to have finished. */
  constructor(private readonly start: FightSetup, seats: Seat[], private readonly hooks: RoomHooks = {}) {
    this.fight = new Fight(start);
    this.players = [...start.players];
    this.seats = seats.map((seat) => seated(seat));
  }

  /** Everyone who has been in it, gone or not, in seat order. */
  get setup(): FightSetup {
    return { ...this.start, players: [...this.players] };
  }

  get refusal(): "duel" | "full" | null {
    if (this.fight.duel) return "duel";
    return this.decided || this.seats.filter((s) => !s.gone).length >= MAX_BATTLE_PLAYERS ? "full" : null;
  }

  join(seat: Seat, player: Omit<PlayerSetup, "at">): number | null {
    if (this.refusal) return null;
    const at = this.seats.length, setup = { ...player, at: joinStart(this.fight.arena, at) };
    this.fight.join(setup);
    this.players.push(setup);
    for (const s of this.seats) {
      if (s.gone) continue;
      s.seat.link.send({ t: "battleJoined", player: setup });
      this.sendSync(s);
    }
    this.seats.push(seated(seat, this.fight.steps));
    return at;
  }

  /** Over for everyone, and freed. */
  get over(): boolean {
    return this.ended;
  }

  get afterFight(): boolean {
    return this.decided && !this.ended;
  }

  inArena(seat: number): boolean {
    const s = this.seats[seat];
    return !!s && !s.gone && !this.ended;
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

  edit(seat: number, change: (world: World, player: Entity) => void): void {
    const e = this.fight.players[seat];
    if (this.ended || e === undefined) return;
    change(this.fight.world, e);
    if (this.started) for (const s of this.seats) if (!s.gone) this.sendSync(s);
  }

  /** Mid-fight it's over for them now (outcome.ts: LEAVING_LOSES); after a win they just go. */
  leave(seat: number): void {
    const s = this.seats[seat];
    if (!s || s.gone || this.ended) return;
    s.gone = true;
    const e = this.fight.players[seat]!;
    const vitals = this.vitalsOf(e);
    this.fight.leave(e);
    if (!this.decided) this.end(s, e, this.resultOf(e, true), vitals);
    if (this.seats.every((other) => other.gone)) this.close();
    else if (this.started) for (const other of this.seats) if (!other.gone) this.sendSync(other);
  }

  /** Each player's session calls it with their seat; only the first seat still here moves the clock. */
  tick(seat?: number): void {
    if (seat !== undefined && seat !== this.seats.findIndex((s) => !s.gone)) return;
    if (this.ended || !this.ready()) return;
    this.now++;
    while (!this.ended && this.fight.steps < this.now) {
      const next = this.fight.steps + 1;
      const overdue = this.now - next >= MAX_INPUT_DELAY_STEPS;
      if (!overdue && !this.seats.every((s) => s.gone || s.inputs.known(next))) break;
      this.runStep(next);
    }
    this.relay();
  }

  private runStep(step: number): void {
    this.fight.step(this.seats.map((s) => {
      const input = s.gone ? IDLE_INPUT : s.inputs.take(step);
      if (!sameInput(input, s.ran)) s.unrelayed.push({ step, ...input });
      s.ran = input;
      return input;
    }));
    if (!this.decided) this.settle();
    if (this.ended) return;
    if (step % HASH_EVERY_STEPS === 0) {
      this.relay();
      this.sendHash();
    }
  }

  /** Each player gets the others' inputs as they ran (before any hash of the steps they ran on). */
  private relay(): void {
    if (this.ended || this.seats.length < 2) return;
    this.seats.forEach((to, i) => {
      if (to.gone) return;
      const inputs = this.seats.flatMap((from, seat) =>
        seat !== i && from.unrelayed.length > 0 ? [{ seat, changes: from.unrelayed }] : []);
      if (inputs.length > 0) to.seat.link.send({ t: "battleInputs", inputs });
    });
    for (const s of this.seats) s.unrelayed = [];
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

  /** Everyone whose fight is over gets the fight as it ended (their copy may differ), then their result. */
  private settle(): void {
    const stay = this.fight.outcome.state === "won" && !this.fight.duel;
    this.seats.forEach((s, i) => {
      if (s.gone) return;
      const e = this.fight.players[i]!;
      const result = this.resultOf(e, false);
      if (result === "fighting") return;
      s.gone = !stay;
      this.sendSync(s);
      this.end(s, e, result, this.vitalsOf(e));
    });
    if (this.fight.outcome.state === "fighting") return;
    this.decided = true;
    this.hooks.onOver?.();
    if (this.seats.every((s) => s.gone)) this.close();
  }

  private end(s: SeatState, e: Entity, result: PlayerResult, vitals: Vitals): void {
    const { book, gear } = this.fight.world.require(e, Player);
    s.seat.onEnd(result, vitals, book, gear);
  }

  private resultOf(e: Entity, left: boolean): PlayerResult {
    const standing = this.fight.world.require(e, Health).hp > 0;
    return playerResult(this.fight.outcome, left, { standing, duel: this.fight.duel });
  }

  private vitalsOf(e: Entity): Vitals {
    return { hp: this.fight.world.require(e, Health).hp, stamina: this.fight.world.require(e, Stamina).value };
  }

  private close(): void {
    if (!this.decided) this.hooks.onOver?.();
    this.ended = true;
    this.fight.dispose();
    this.hooks.onClosed?.();
  }
}
