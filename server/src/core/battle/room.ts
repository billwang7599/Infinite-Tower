/**
 * A fight, as the server runs it: the shared Fight, stepped once a tick with each player's next input (inputs.ts),
 * telling each player how it stands (`battleState`, 20 times a second) and, once it's over for them, how it ended.
 * It's authoritative: hits, damage, stamina, deaths and the result are all the server's. Built for any number of
 * players; every battle has one for now, and that player's session ticks it (game/session.ts).
 */
import {
  Health, IDLE_INPUT, Stamina, type BattleEvent, type BattleInput, type Entity, type Vitals,
} from "@infinite-tower/shared";
import { Fight, playerResult, readPlayerState, type FightSetup, type PlayerResult } from "@infinite-tower/shared/fight";
import type { PlayerLink } from "../ports.js";
import { InputQueue } from "./inputs.js";
import { battleEvent, enemySnap, playerSnap } from "./snapshot.js";

/** Steps between `battleState`s: 60 Hz / 3 = 20 a second. */
export const SNAPSHOT_EVERY_STEPS = 3;
/**
 * The fight starts once every player has sent their first input (they've flashed into the arena and can see it), or
 * after this many seconds, whichever is first.
 */
export const MAX_START_WAIT_TIME = 5;

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
  inputs: InputQueue;
  /** Disconnected: out of the fight. */
  gone: boolean;
}

export class BattleRoom {
  readonly fight: Fight;
  private readonly seats: SeatState[];
  /** Players then enemies: how events and states number the fighters. */
  private readonly fighters: Entity[];
  /** What happened since the last `battleState`. */
  private readonly events: BattleEvent[] = [];
  private steps = 0;
  private waitedTime = 0;
  private started = false;
  private ended = false;

  /** `seats[i]` plays `setup.players[i]`. Needs initPhysics() to have finished. */
  constructor(setup: FightSetup, seats: Seat[]) {
    this.fight = new Fight(setup);
    this.seats = seats.map((seat) => ({ seat, inputs: new InputQueue(), gone: false }));
    this.fighters = [...this.fight.players, ...this.fight.enemies];
  }

  /** Over for everyone, and freed. */
  get over(): boolean {
    return this.ended;
  }

  /** Player `seat`'s inputs, as they came. */
  input(seat: number, inputs: readonly BattleInput[]): void {
    const s = this.seats[seat];
    if (s && !s.gone && !this.ended) s.inputs.push(inputs);
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

  /** One fixed step (FIXED_DT), once everyone is in. */
  tick(): void {
    if (this.ended || !this.ready()) return;
    this.fight.step(this.seats.map((s) => (s.gone ? IDLE_INPUT : s.inputs.next())));
    this.steps++;
    for (const event of this.fight.events) this.events.push(battleEvent(this.fighters, event));
    const decided = this.fight.outcome.state !== "fighting";
    if (decided || this.steps % SNAPSHOT_EVERY_STEPS === 0) this.sendState();
    if (!decided) return;
    this.seats.forEach((s, i) => {
      if (!s.gone) s.seat.onEnd(playerResult(this.fight.outcome, false), this.vitalsOf(this.fight.players[i]!));
    });
    this.close();
  }

  private ready(): boolean {
    if (this.started) return true;
    this.waitedTime += Fight.STEP_SECONDS;
    this.started = this.seats.every((s) => s.gone || s.inputs.started) || this.waitedTime >= MAX_START_WAIT_TIME;
    return this.started;
  }

  private sendState(): void {
    const { world, players } = this.fight;
    const playerSnaps = players.map((e) => playerSnap(world, e));
    const enemies = this.fight.enemies.map((e) => enemySnap(world, e));
    const events = this.events.splice(0);
    this.seats.forEach((s, i) => {
      if (s.gone) return;
      s.seat.link.send({
        t: "battleState", step: this.steps, ack: s.inputs.ack, repeats: s.inputs.repeats,
        outcome: this.fight.outcome.state, me: readPlayerState(this.fight, players[i]!),
        players: playerSnaps.map((snap, j) => (j === i ? null : snap)), enemies, events,
      });
    });
  }

  private vitalsOf(e: Entity): Vitals {
    return { hp: this.fight.world.require(e, Health).hp, stamina: this.fight.world.require(e, Stamina).value };
  }

  private close(): void {
    this.ended = true;
    this.fight.dispose();
  }
}
