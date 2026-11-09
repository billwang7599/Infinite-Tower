/**
 * A fight from both ends, for testing the server's BattleRoom: the client's side (the same shared Fight, stepped
 * with the player's input every step, as the browser runs it) and the wire between them, which can hold any message
 * back for a number of server ticks.
 */
import {
  appliedStrength, blankSkillbook, emptyBag, emptyEquipment, IDLE_INPUT, newCore, packFor, sameInput, type EnemyDef, type Equipment,
  type PlayerInputData, type StepInput, type Vitals,
} from "@infinite-tower/shared";
import {
  ENEMY_START, ENEMY_START_YAW, Fight, PLAYER_START, type FightSetup, type PlayerResult,
} from "@infinite-tower/shared/fight";
import { BattleRoom } from "../../src/core/battle/room.js";
import { fullVitals, PLAYER_STATS } from "../../src/core/content/player.js";
import { ENEMIES } from "../../src/core/enemies/index.js";
import { FakeLink } from "./fakes.js";

export const armed = (): Equipment => ({ ...emptyEquipment(), rightHand: "sword", leftHand: "skillbook" });

export const FULL = fullVitals(PLAYER_STATS);

/** An enemy's grip strength with the hands it's given. */
export const gripStrengthOf = (def: EnemyDef): number =>
  appliedStrength({ rightHand: null, leftHand: null, ...def.wielder?.hands }, def.stats.strength);

/** The wild boar, rooted to the spot and harmless. */
const STATUE: EnemyDef = { ...ENEMIES["wild-boar"].def, walkSpeed: 0, turnRate: 0, attacks: {} };

export function setupWith(def: EnemyDef = STATUE, enemyAt = ENEMY_START, playerAt = PLAYER_START): FightSetup {
  return {
    arena: { id: "test", radius: 16, look: "forest-clearing" },
    players: [{ at: playerAt, vitals: { ...FULL }, stats: PLAYER_STATS, core: newCore(),
      burden: "light", gear: { bag: emptyBag(), pack: packFor(null), quiver: packFor(null), equipment: armed() },
      book: blankSkillbook() }],
    enemies: [{ def, at: enemyAt, yaw: ENEMY_START_YAW }],
  };
}

export const fightWith = (def: EnemyDef, seed: number): Fight =>
  new Fight({ ...setupWith(def), enemies: [{ def, at: ENEMY_START, yaw: ENEMY_START_YAW, seed }] });

/** One battleInput: the changes since the last one, and the last step the client has run. */
export interface Sent { upTo: number; inputs: StepInput[] }

/** The browser's side: its own copy of the fight, run with its inputs at once, and one message per step. */
export class FakeClient {
  readonly fight: Fight;
  private last: PlayerInputData | null = null;

  constructor(setup: FightSetup) {
    this.fight = new Fight(setup);
  }

  /** One step with `input`; returns what goes to the server for it. */
  step(input: PlayerInputData = IDLE_INPUT): Sent {
    const step = this.fight.steps + 1;
    const changed = !this.last || !sameInput(this.last, input);
    this.last = input;
    this.fight.step([input]);
    return { upTo: step, inputs: changed ? [{ step, ...input }] : [] };
  }
}

/**
 * A room with one player on a FakeLink and their client, played in lockstep: each round the client runs its next
 * step and sends it, and the server ticks once. A message can be held back some ticks; like the socket, the wire
 * keeps order, so what was sent after it waits too.
 */
export function openRoom(setup = setupWith()) {
  const link = new FakeLink();
  const ended: { result: PlayerResult; vitals: Vitals }[] = [];
  const room = new BattleRoom(setup, [{ link, onEnd: (result, vitals) => ended.push({ result, vitals }) }]);
  const client = new FakeClient(setup);
  const wire: { at: number; sent: Sent }[] = [];
  let ticks = 0;

  /** The server's next tick, after delivering what has arrived by then. */
  const tick = () => {
    ticks++;
    while (wire[0] && wire[0].at <= ticks) {
      const { sent } = wire.shift()!;
      room.input(0, sent.upTo, sent.inputs);
    }
    room.tick();
  };

  /** One round: the client's step `input` (unless null: it stays silent), then one server tick. */
  const play = (input: PlayerInputData | null = IDLE_INPUT, delay = 0) => {
    if (input) wire.push({ at: ticks + 1 + delay, sent: client.step(input) });
    tick();
  };

  return { link, room, ended, client, play, tick };
}
