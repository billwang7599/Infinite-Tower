import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Body, dodgeCost, emptyBag, FIXED_DT, HASH_EVERY_STEPS, Health, IDLE_INPUT, Player, PLAYER, quantizeInput, Stamina,
  starterEquipment,
  type ClientMsg, type EnemyDef, type PlayerInputData, type ServerMsgOf, type StepInput,
} from "@infinite-tower/shared";
import { ENEMY_START_YAW, Fight, initPhysics, type FightSetup } from "@infinite-tower/shared/fight";
import { resultShown } from "../../../src/modes/battle/context.js";
import { FightSync, INPUT_HEARTBEAT_STEPS } from "../../../src/modes/battle/sync.js";
import { FakeNet } from "../../fixtures/fake-net.js";

before(() => initPhysics());

const STATS = { stamina: 100, skillpower: 10, agility: 10, strength: 10 };
/** Walks up to whoever is there and stands; never attacks. */
const WALKER: EnemyDef = {
  id: "wild-boar", name: "Walker", maxHp: 100, stats: STATS, radius: 0.85, walkSpeed: 3, turnRate: 3,
  poise: 1000, poiseRegen: 0, staggerTime: 1, attacks: {},
};
const SETUP: FightSetup = {
  arena: { id: "test", radius: 16, look: "forest-clearing" },
  players: [{
    at: { x: 0, y: 0.05, z: -4 }, vitals: { hp: PLAYER.maxHp, stamina: 100 }, stats: STATS, burden: "light",
    gear: { bag: emptyBag(), equipment: starterEquipment() }, book: [],
  }],
  enemies: [{ def: WALKER, at: { x: 0, y: 0.05, z: 8 }, yaw: ENEMY_START_YAW }],
};
const input = (over: Partial<PlayerInputData>): PlayerInputData => ({ ...IDLE_INPUT, ...over });
/** Walking forward-right, the aim turned a little: numbers that need rounding for the wire. */
const WALK = input({ moveX: Math.SQRT1_2, moveZ: Math.SQRT1_2, aimX: Math.sin(0.3), aimZ: Math.cos(0.3) });
/** Something new every few steps. */
const script = (step: number): PlayerInputData => input({
  moveX: step % 40 < 20 ? 1 : -1, moveZ: step % 24 < 12 ? 0.5 : -0.5, attack: step % 11 === 0 ? "light" : null,
  locked: 0, guard: step % 50 > 44 ? "right" : "top",
});

/** The server's side, honest and on time: its fight runs each change from its step, until the next. */
class FakeServer {
  readonly fight = new Fight(SETUP);
  private changes: StepInput[] = [];
  private held: PlayerInputData = IDLE_INPUT;
  upTo = 0;
  resyncs = 0;

  receive(net: FakeNet): void {
    for (const msg of net.sent.splice(0)) {
      if (msg.t === "battleInput") {
        this.changes.push(...msg.inputs);
        this.upTo = msg.upTo;
      } else if (msg.t === "battleResync") this.resyncs++;
    }
  }

  /** Runs to step `to` (as far as it has inputs for, by default); returns the hashes it would send. */
  run(to = this.upTo): ServerMsgOf<"battleHash">[] {
    const hashes: ServerMsgOf<"battleHash">[] = [];
    while (this.fight.steps < to) {
      const step = this.fight.steps + 1;
      while (this.changes[0] && this.changes[0].step <= step) {
        const { step: _, ...change } = this.changes.shift()!;
        this.held = change;
      }
      this.fight.step([this.held]);
      if (step % HASH_EVERY_STEPS === 0) {
        hashes.push({ t: "battleHash", step, hash: this.fight.hash(), lateSteps: 0, heardStep: this.upTo });
      }
    }
    return hashes;
  }

  sync(): ServerMsgOf<"battleSync"> {
    const fight = JSON.parse(JSON.stringify(this.fight.save()));
    return { t: "battleSync", step: this.fight.steps, fight, lateSteps: 0, heardStep: this.upTo };
  }
}

function setup() {
  const fight = new Fight(SETUP);
  const net = new FakeNet();
  const sync = new FightSync(fight, 0, (msg) => net.send(msg));
  /** One frame with one step: run it, send what's due. */
  const step = (next: PlayerInputData) => {
    sync.advance(next);
    sync.flush();
  };
  return { fight, net, sync, step, server: new FakeServer() };
}

const inputsSent = (sent: ClientMsg[]) => sent.flatMap((m) => (m.t === "battleInput" ? [m] : []));
const resyncsSent = (sent: ClientMsg[]) => sent.filter((m) => m.t === "battleResync").length;

describe("the client's own copy of the fight", () => {
  test("sends only changes, each with its step, rounded for the wire, and how far it has got", () => {
    const { net, step } = setup();
    for (const next of [WALK, WALK, IDLE_INPUT, IDLE_INPUT, input({ attack: "light" }), IDLE_INPUT]) step(next);
    assert.deepEqual(inputsSent(net.sent), [
      { t: "battleInput", upTo: 1, inputs: [{ step: 1, ...quantizeInput(WALK) }] },
      { t: "battleInput", upTo: 3, inputs: [{ step: 3, ...IDLE_INPUT }] },
      { t: "battleInput", upTo: 5, inputs: [{ step: 5, ...input({ attack: "light" }) }] },
      { t: "battleInput", upTo: 6, inputs: [{ step: 6, ...IDLE_INPUT }] },
    ]);
  });

  test("with nothing new, it still says how far it has got every INPUT_HEARTBEAT_STEPS steps", () => {
    const { net, step } = setup();
    for (let i = 0; i < 1 + INPUT_HEARTBEAT_STEPS * 3; i++) step(WALK);
    assert.deepEqual(inputsSent(net.sent).map((m) => m.upTo), [0, 1, 2, 3].map((n) => 1 + n * INPUT_HEARTBEAT_STEPS));
  });

  test("a frame's steps go out together in one message", () => {
    const { net, sync } = setup();
    sync.advance(WALK);
    sync.advance(IDLE_INPUT);
    sync.advance(IDLE_INPUT);
    sync.flush();
    sync.flush();
    assert.deepEqual(inputsSent(net.sent).map((m) => [m.upTo, m.inputs.map((i) => i.step)]), [[3, [1, 2]]]);
  });

  test("runs the whole fight at once: the enemy comes at you before the server has said anything", () => {
    const { fight, step } = setup();
    const alone = new Fight(SETUP);
    for (let i = 1; i <= 90; i++) {
      step(script(i));
      alone.step([quantizeInput(script(i))]);
    }
    const boar = fight.world.require(fight.enemies[0]!, Body).pos;
    assert.ok(boar.z < 6, `the boar walked up (z ${boar.z})`);
    assert.deepEqual(fight.save(), alone.save());
  });

  test("when the server's hashes match, it asks for nothing", () => {
    const { net, sync, step, server } = setup();
    for (let i = 1; i <= HASH_EVERY_STEPS * 4 + INPUT_HEARTBEAT_STEPS; i++) {
      step(script(i));
      server.receive(net);
      for (const hash of server.run()) sync.onHash(hash);
    }
    assert.equal(server.resyncs, 0);
    assert.deepEqual(sync.stats, {
      checks: 4, mismatches: 0, restores: 0, corrections: 0, hiddenHits: 0, hiddenDodgeHits: 0,
    });
  });

  test("a hash for a step it hasn't run yet is checked when it gets there", () => {
    const { net, sync, step, server } = setup();
    for (let i = 1; i <= 5; i++) step(script(i));
    server.receive(net);
    server.run();
    // The server's copy is pushed: the client will see it differs once it has run the step.
    server.fight.world.require(server.fight.players[0]!, Health).hp -= 20;
    const hashes = server.run(HASH_EVERY_STEPS);
    assert.equal(hashes.length, 1);
    sync.onHash(hashes[0]!);
    assert.equal(resyncsSent(net.sent), 0);
    for (let i = 6; i <= HASH_EVERY_STEPS; i++) step(input({}));
    assert.equal(resyncsSent(net.sent), 1);
  });

  test("a mismatch asks once for the server's fight, loads it, replays its inputs since, and ends up the same", () => {
    const { fight, net, sync, step, server } = setup();
    const hit = () => {
      // Something only the server saw: knocked back and stunned by a hit, 30 HP gone.
      const me = server.fight.players[0]!;
      Object.assign(server.fight.world.require(me, Body).vel, { x: -8, y: 3, z: 2 });
      Object.assign(server.fight.world.require(me, Health), { hp: PLAYER.maxHp - 30, hitstun: 0.3, invuln: 0.6 });
    };
    const hashes: ServerMsgOf<"battleHash">[] = [];
    const until = HASH_EVERY_STEPS * 3 + 5;
    for (let i = 1; i <= until; i++) {
      step(script(i));
      server.receive(net);
      if (i === 20) {
        hashes.push(...server.run(19));
        hit();
      }
      // The server is 5 steps behind the client (its inputs take that long to get there).
      if (i > 25) hashes.push(...server.run(i - 5));
      for (const hash of hashes.splice(0)) sync.onHash(hash);
    }
    assert.equal(sync.stats.mismatches, 2, "two hashes came before the fight did");
    server.receive(net);
    assert.equal(server.resyncs, 1, "asked once");
    sync.onSync(server.sync());
    assert.equal(fight.steps, until, "back where it was, replayed");
    assert.equal(fight.world.require(fight.players[0]!, Health).hp, PLAYER.maxHp - 30);
    for (let i = until + 1; i <= HASH_EVERY_STEPS * 5; i++) step(script(i));
    server.receive(net);
    server.run(fight.steps);
    assert.deepEqual(fight.save(), server.fight.save(), "where the server gets to");
    assert.equal(sync.stats.restores, 1);
    assert.equal(sync.stats.corrections, 1);
    assert.equal(sync.stats.hiddenHits, 1, "a hit it hadn't shown");
  });

  test("a sync from a step it hasn't reached (it fell behind) puts it there", () => {
    const { fight, net, sync, step, server } = setup();
    for (let i = 1; i <= 10; i++) step(script(i));
    server.receive(net);
    server.run(40);
    sync.onSync(server.sync());
    assert.equal(fight.steps, 40);
    assert.deepEqual(fight.save(), server.fight.save());
    step(script(41));
    assert.equal(inputsSent(net.sent).at(-1)?.upTo, 41);
  });

  test("stalled (no frames: a slow first frame, a hidden tab), it asks for the server's fight once, as it runs again", () => {
    const { fight, net, sync, step, server } = setup();
    for (let i = 1; i <= 10; i++) step(IDLE_INPUT);
    let answered = 0;
    const answer = () => {
      server.receive(net);
      for (; answered < server.resyncs; answered++) sync.onSync(server.sync());
    };
    for (let to = 2 * HASH_EVERY_STEPS; to <= 8 * HASH_EVERY_STEPS; to += HASH_EVERY_STEPS) {
      for (const hash of server.run(to)) sync.onHash(hash);
      answer();
    }
    assert.equal(server.resyncs, 0, "nothing asked while it runs no steps");
    for (let i = 0; i < 2 * HASH_EVERY_STEPS; i++) {
      step(IDLE_INPUT);
      answer();
      for (const hash of server.run(server.fight.steps + 1)) sync.onHash(hash);
    }
    assert.equal(server.resyncs, 1, "asked once, as it ran again");
    assert.equal(sync.stats.restores, 1);
    assert.ok(fight.steps >= 8 * HASH_EVERY_STEPS, "where the server is");
    assert.ok(sync.stats.checks > 0);
    assert.equal(sync.stats.mismatches, 0);
  });

  test("reports every step's events with their step, and a replayed step's again", () => {
    const { fight, net, sync, step, server } = setup();
    const run = fight.step.bind(fight);
    fight.step = (inputs) => {
      run(inputs);
      fight.events.push({ type: "slam", enemy: fight.steps });
    };
    for (let i = 1; i <= 20; i++) step(script(i));
    server.receive(net);
    server.run(10);
    sync.onSync(server.sync());
    const steps = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
    assert.deepEqual(sync.events.map((e) => e.step), [...steps(1, 20), ...steps(11, 20)]);
    assert.ok(sync.events.every(({ step, event }) => event.type === "slam" && event.enemy === step));
  });

  test("a rollback neither replays a dodge twice nor drops it", () => {
    const DODGE_AT = 25;
    const dodgeScript = (i: number) => (i === DODGE_AT ? input({ moveX: 1, dodge: true }) : IDLE_INPUT);
    const cost = dodgeCost("light")!;
    for (const syncAt of [20, DODGE_AT, 30]) {
      const { fight, net, sync, step, server } = setup();
      for (let i = 1; i <= 35; i++) step(dodgeScript(i));
      server.receive(net);
      server.run(syncAt);
      sync.onSync(server.sync());
      const me = fight.players[0]!;
      assert.equal(fight.world.require(me, Player).action, "dodge", `synced at ${syncAt}`);
      assert.ok(Math.abs(fight.world.require(me, Player).actionTime - (35 - DODGE_AT + 1) * FIXED_DT) < 1e-9);
      assert.equal(fight.world.require(me, Stamina).value, STATS.stamina - cost, `one dodge's stamina, at ${syncAt}`);
      server.run(35);
      assert.deepEqual(fight.save(), server.fight.save(), `synced at ${syncAt}`);
    }
  });
});

describe("the fight's result", () => {
  test("waits for the server: the client's own fight may be won, but the outcome and banner wait", () => {
    const { fight, sync, step } = setup();
    step(IDLE_INPUT);
    fight.world.require(fight.enemies[0]!, Health).hp = 0;
    for (let i = 0; i < 3 / FIXED_DT; i++) step(IDLE_INPUT);
    assert.equal(fight.outcome.state, "won", "the client's own copy is decided");
    assert.equal(sync.outcome.state, "fighting");
    assert.equal(resultShown(sync.outcome), false, "no banner");
    sync.onResult(true, false);
    assert.equal(sync.outcome.state, "won");
    assert.equal(resultShown(sync.outcome), true, "the banner at once: the fight was decided seconds ago");
  });

  test("the banner shows as long after the decision as ever, counted in the client's own steps", () => {
    const { fight, sync, step } = setup();
    step(IDLE_INPUT);
    fight.world.require(fight.enemies[0]!, Health).hp = 0;
    step(IDLE_INPUT);
    sync.onResult(true, false);
    assert.equal(resultShown(sync.outcome), false);
    for (let i = 0; i < 2 / FIXED_DT; i++) step(IDLE_INPUT);
    assert.equal(resultShown(sync.outcome), true);
  });

  test("a result the client didn't see coming is the server's: lost, though the client's copy fights on", () => {
    const { fight, sync, step } = setup();
    step(IDLE_INPUT);
    sync.onResult(false, false);
    assert.equal(sync.outcome.state, "lost");
    assert.equal(fight.outcome.state, "fighting");
  });

  test("after a result that closes the arena nothing more is sent, and hashes change nothing", () => {
    const { net, sync, step, server } = setup();
    step(WALK);
    server.receive(net);
    sync.onResult(true, false);
    for (let i = 0; i < HASH_EVERY_STEPS * 2; i++) step(script(i));
    assert.deepEqual(net.sent, []);
    sync.onHash({ t: "battleHash", step: HASH_EVERY_STEPS, hash: 1, lateSteps: 0, heardStep: 1 });
    assert.deepEqual(net.sent, []);
  });

  test("after a win that keeps the arena open, inputs still go and the server's hashes are still checked", () => {
    const { net, sync, step, server } = setup();
    step(WALK);
    server.receive(net);
    sync.onResult(true, true);
    assert.equal(sync.outcome.state, "won");
    for (let i = 0; i < HASH_EVERY_STEPS * 2; i++) step(script(i));
    assert.ok(inputsSent(net.sent).length > 0, "inputs sent");
    server.receive(net);
    const [hash] = server.run();
    sync.onHash({ ...hash!, hash: hash!.hash + 1 });
    assert.equal(resyncsSent(net.sent), 1, "a mismatch still asks for the server's fight");
  });
});

describe("a duel: the other player's inputs come from the server", () => {
  const DUEL: FightSetup = {
    arena: SETUP.arena, duel: true, enemies: [],
    players: [SETUP.players[0]!, { ...SETUP.players[0]!, at: { x: 0, y: 0.05, z: 4 } }],
  };
  const theirs = (step: number): PlayerInputData => input({
    moveX: step % 30 < 15 ? -1 : 1, moveZ: step % 36 < 18 ? -0.5 : 0.5, aimZ: -1,
    attack: step % 17 === 0 ? "heavy" : null, locked: step % 60 > 20 ? 0 : null, guard: step % 50 > 25 ? "left" : "top",
  });
  const changesUpTo = (to: number): StepInput[] => {
    const changes: StepInput[] = [];
    for (let step = 1; step <= to; step++) {
      if (step === 1 || JSON.stringify(theirs(step)) !== JSON.stringify(theirs(step - 1))) {
        changes.push({ step, ...theirs(step) });
      }
    }
    return changes;
  };
  const relay = (changes: StepInput[]): ServerMsgOf<"battleInputs"> =>
    ({ t: "battleInputs", inputs: [{ seat: 1, changes }] });

  function duel() {
    const fight = new Fight(DUEL);
    const net = new FakeNet();
    const sync = new FightSync(fight, 0, (msg) => net.send(msg));
    const truth = new Fight(DUEL);
    return { fight, net, sync, truth };
  }

  test("until their input comes, they're shown doing what they last did", () => {
    const { fight, sync } = duel();
    sync.onInputs(relay([{ step: 1, ...input({ moveX: 1 }) }]));
    for (let i = 0; i < 30; i++) sync.advance(IDLE_INPUT);
    assert.ok(fight.world.require(fight.players[1]!, Body).pos.x > 1);
  });

  test("their inputs arriving late roll the fight back and replay it: it ends as if known all along", () => {
    const { fight, net, sync, truth } = duel();
    const LAG = 9;
    let relayed = 0;
    for (let step = 1; step <= 150; step++) {
      sync.advance(script(step));
      truth.step([quantizeInput(script(step)), theirs(step)]);
      const known = step - LAG;
      if (known > relayed) {
        sync.onInputs(relay(changesUpTo(known).filter((c) => c.step > relayed)));
        relayed = known;
      }
    }
    sync.onInputs(relay(changesUpTo(150).filter((c) => c.step > relayed)));
    assert.equal(fight.hash(), truth.hash());
    assert.deepEqual(fight.save(), truth.save());
    assert.equal(resyncsSent(net.sent), 0);
  });

  test("their inputs for steps not run yet wait for those steps", () => {
    const { fight, sync, truth } = duel();
    sync.onInputs(relay(changesUpTo(40)));
    for (let step = 1; step <= 40; step++) {
      sync.advance(IDLE_INPUT);
      truth.step([IDLE_INPUT, theirs(step)]);
    }
    assert.deepEqual(fight.save(), truth.save());
  });

  test("after the server's fight is loaded, the replay uses their inputs too", () => {
    const { fight, sync, truth } = duel();
    for (let step = 1; step <= 20; step++) truth.step([IDLE_INPUT, theirs(step)]);
    const snapshot = JSON.parse(JSON.stringify(truth.save()));
    sync.onInputs(relay(changesUpTo(40)));
    for (let step = 1; step <= 40; step++) sync.advance(IDLE_INPUT);
    sync.onSync({ t: "battleSync", step: 20, fight: snapshot, lateSteps: 0, heardStep: 20 });
    for (let step = 21; step <= 40; step++) truth.step([IDLE_INPUT, theirs(step)]);
    assert.deepEqual(fight.save(), truth.save());
  });
});

describe("a player joining the fight", () => {
  const JOINER = { ...SETUP.players[0]!, at: { x: 3, y: 0.05, z: -6 } };

  test("told who, the copy takes the server's fight with them in it and replays your inputs since", () => {
    const { fight, sync, server } = setup();
    for (let step = 1; step <= 20; step++) sync.advance(script(step));
    for (let step = 1; step <= 12; step++) server.fight.step([quantizeInput(script(step))]);
    server.fight.join(JOINER);
    sync.onJoined(JOINER);
    sync.onSync(server.sync());
    assert.equal(fight.players.length, 2);
    for (let step = 13; step <= 20; step++) server.fight.step([quantizeInput(script(step)), IDLE_INPUT]);
    assert.deepEqual(fight.save(), server.fight.save());
  });

  test("their inputs relayed after that roll the fight back like any other player's", () => {
    const { fight, sync, server } = setup();
    for (let step = 1; step <= 10; step++) {
      sync.advance(IDLE_INPUT);
      server.fight.step([IDLE_INPUT]);
    }
    server.fight.join(JOINER);
    sync.onJoined(JOINER);
    sync.onSync(server.sync());
    const walk = input({ moveX: 1 });
    for (let step = 11; step <= 30; step++) {
      sync.advance(IDLE_INPUT);
      server.fight.step([IDLE_INPUT, step >= 15 ? walk : IDLE_INPUT]);
    }
    sync.onInputs({ t: "battleInputs", inputs: [{ seat: 1, changes: [{ step: 15, ...walk }] }] });
    assert.deepEqual(fight.save(), server.fight.save());
  });
});
