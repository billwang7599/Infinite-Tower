import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Body, Health, IDLE_INPUT, PLAYER, quantizeInput, type BattleInput, type PlayerInputData,
} from "@infinite-tower/shared";
import {
  ENEMY_START_YAW, Fight, initPhysics, readPlayerState, type FightSetup, type PlayerState,
} from "@infinite-tower/shared/fight";
import { BattlePrediction } from "../../src/battle/prediction.js";
import { FakeNet } from "../fixtures/fake-net.js";

before(() => initPhysics());

const STATS = { stamina: 100, mana: 50, spellpower: 10, agility: 10, strength: 10 };
/** You, and an enemy far off that never moves. */
const SETUP: FightSetup = {
  arena: { radius: 16 },
  players: [{
    at: { x: 0, y: 0.05, z: -4 }, vitals: { hp: PLAYER.maxHp, stamina: 100 }, stats: STATS, burden: "light",
  }],
  enemies: [{
    def: {
      id: "statue", name: "Statue", model: "boar", maxHp: 100, stats: STATS, radius: 0.85, walkSpeed: 0, turnRate: 0,
      poise: 1000, poiseRegen: 0, staggerTime: 1, attacks: {},
    },
    at: { x: 0, y: 0.05, z: 12 }, yaw: ENEMY_START_YAW,
  }],
};
const input = (over: Partial<PlayerInputData>): PlayerInputData => ({ ...IDLE_INPUT, ...over });
/** Walking forward-right, with the aim turned a little: numbers that need rounding for the wire. */
const WALK = input({ moveX: Math.SQRT1_2, moveZ: Math.SQRT1_2, aimX: Math.sin(0.3), aimZ: Math.cos(0.3) });

/**
 * The server's side, as far as this player goes: their fight, the inputs it got, at most one a step, the last one
 * again when none is waiting (counted in `repeats`).
 */
class FakeServer {
  readonly fight = new Fight(SETUP);
  private waiting: BattleInput[] = [];
  private last: PlayerInputData = IDLE_INPUT;
  ack = 0;
  repeats = 0;

  receive(net: FakeNet): void {
    for (const msg of net.sent.splice(0)) if (msg.t === "battleInput") this.waiting.push(...msg.inputs);
  }

  step(): void {
    const next = this.waiting.shift();
    if (next) {
      const { seq, ...input } = next;
      this.last = input;
      this.ack = seq;
      this.repeats = 0;
    } else {
      this.repeats++;
    }
    this.fight.step([this.last]);
  }

  state(): { ack: number; repeats: number; me: PlayerState } {
    return { ack: this.ack, repeats: this.repeats, me: JSON.parse(JSON.stringify(this.me())) };
  }

  me(): PlayerState {
    return readPlayerState(this.fight, this.fight.players[0]!);
  }
}

function setup() {
  const fight = new Fight(SETUP);
  const net = new FakeNet();
  const prediction = new BattlePrediction(fight, fight.players[0]!, (msg) => net.send(msg));
  const me = () => readPlayerState(fight, fight.players[0]!);
  /** One client step: predict, and send at once (as a frame with one step would). */
  const step = (next: PlayerInputData) => {
    prediction.step(next);
    prediction.flush();
  };
  return { fight, net, prediction, me, step };
}

describe("predicting your own fighter", () => {
  test("sends each step's input numbered and rounded for the wire; standing idle is sent once, not repeated", () => {
    const { net, step } = setup();
    const steps = [WALK, IDLE_INPUT, IDLE_INPUT, input({ aimX: 1, aimZ: 0 }), input({ attack: true }), IDLE_INPUT];
    for (const next of steps) step(next);
    const sent = net.sent.flatMap((m) => (m.t === "battleInput" ? m.inputs : []));
    assert.deepEqual(sent, [
      { seq: 1, ...quantizeInput(WALK) }, { seq: 2, ...IDLE_INPUT }, { seq: 5, ...input({ attack: true }) },
      { seq: 6, ...IDLE_INPUT },
    ]);
  });

  test("a frame's steps go out together in one message, and nothing goes when there's nothing new", () => {
    const { net, prediction } = setup();
    prediction.step(WALK);
    prediction.step(WALK);
    prediction.step(WALK);
    prediction.flush();
    prediction.flush();
    assert.equal(net.sent.length, 1);
    assert.deepEqual(net.sent[0]?.t === "battleInput" && net.sent[0].inputs.map((i) => i.seq), [1, 2, 3]);
  });

  test("moves you at once, exactly as the server will", () => {
    const { net, me, step } = setup();
    const server = new FakeServer();
    const script = [...Array(20).fill(WALK), input({ attack: true }), ...Array(20).fill(IDLE_INPUT)];
    for (const next of script) {
      step(next);
      server.receive(net);
      server.step();
    }
    assert.deepEqual(me(), server.me());
  });
});

describe("reconciling with the server's state", () => {
  test("when the server agrees, nothing moves", () => {
    const { net, me, prediction, step } = setup();
    const server = new FakeServer();
    for (let i = 0; i < 10; i++) step(WALK);
    server.receive(net);
    for (let i = 0; i < 6; i++) server.step();
    const before = me();
    const moved = prediction.reconcile(server.state());
    assert.deepEqual(me(), before);
    assert.deepEqual(moved, { x: 0, y: 0, z: 0 });
  });

  test("after a mismatch, it takes the server's state, replays only what the server hasn't run, and matches it", () => {
    const { net, me, prediction, step } = setup();
    const server = new FakeServer();
    const script = [...Array(15).fill(WALK), input({ attack: true }), ...Array(14).fill(WALK)];
    for (const next of script) step(next);
    server.receive(net);
    for (let i = 0; i < 12; i++) server.step();
    // Something only the server saw: knocked back and stunned by a hit, 30 HP gone.
    const hit = server.fight.players[0]!;
    Object.assign(server.fight.world.require(hit, Body).vel, { x: -8, y: 3, z: 2 });
    Object.assign(server.fight.world.require(hit, Health), { hp: PLAYER.maxHp - 30, hitstun: 0.3, invuln: 0.6 });
    const predicted = me();

    const moved = prediction.reconcile(server.state());
    assert.notDeepEqual(me(), predicted);
    assert.ok(Math.hypot(moved.x, moved.y, moved.z) > 0, "the correction is reported");
    for (let i = 12; i < script.length; i++) server.step();
    assert.deepEqual(me(), server.me(), "where the server gets to once it has run every input");
  });

  test("idle steps the server ran as repeats aren't run again, however many states come for them", () => {
    const { net, me, prediction, step } = setup();
    const server = new FakeServer();
    for (let i = 0; i < 10; i++) step(WALK);
    for (let i = 0; i < 30; i++) step(IDLE_INPUT);
    server.receive(net);
    for (let i = 0; i < 11 + 20; i++) server.step();
    // Pushed while standing: the server's state differs from what was predicted.
    Object.assign(server.fight.world.require(server.fight.players[0]!, Body).vel, { x: 3, z: -3 });
    prediction.reconcile(server.state());
    for (let i = 0; i < 4; i++) server.step();
    prediction.reconcile(server.state());
    for (let i = 0; i < 5; i++) server.step();
    assert.deepEqual(me(), server.me());
  });

  test("once stopped (the fight is decided), nothing more is sent and states change nothing", () => {
    const { net, me, prediction, step } = setup();
    const server = new FakeServer();
    step(WALK);
    server.receive(net);
    server.step();
    Object.assign(server.fight.world.require(server.fight.players[0]!, Body).pos, { x: 5 });
    prediction.stop();
    step(WALK);
    assert.deepEqual(net.sent, []);
    const before = me();
    prediction.reconcile(server.state());
    assert.deepEqual(me(), before);
  });
});
