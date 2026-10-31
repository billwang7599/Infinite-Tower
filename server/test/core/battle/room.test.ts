import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  HASH_EVERY_STEPS, Health, IDLE_INPUT, MAX_INPUT_DELAY_STEPS, MAX_INPUT_LEAD_STEPS, PLAYER,
  type PlayerInputData,
} from "@infinite-tower/shared";
import { Fight, initPhysics, LEAVING_LOSES, MAX_FIGHT_TIME } from "@infinite-tower/shared/fight";
import { MAX_START_WAIT_TIME, MIN_SYNC_GAP_STEPS } from "../../../src/core/battle/room.js";
import { PLAYER_STATS } from "../../../src/core/content/player.js";
import { FakeClient, openRoom, setupWith } from "../../fixtures/fight.js";

before(() => initPhysics());

const STEP_SECONDS = 1 / 60;
const input = (over: Partial<PlayerInputData>): PlayerInputData => ({ ...IDLE_INPUT, ...over });
/** Walks about, slashes and dodges: something different every few steps. */
const script = (step: number): PlayerInputData => input({
  moveX: step % 50 < 25 ? 1 : -0.5, moveZ: step % 30 < 15 ? 0.6 : -1, aimX: step % 40 < 20 ? 0 : 1,
  aimZ: step % 40 < 20 ? 1 : 0, attack: step % 13 === 0 ? (step % 26 ? "light" : "heavy") : null,
  dodge: step % 37 === 0,
});

describe("a battle room", () => {
  test("waits for the player's first input before the fight starts (they're still flashing into the arena)", () => {
    const { link, room, play } = openRoom();
    for (let i = 0; i < 30; i++) play(null);
    assert.equal(room.fight.steps, 0);
    assert.equal(link.sent.length, 0);
    play();
    assert.equal(room.fight.steps, 1);
  });

  test("starts without it after MAX_START_WAIT_TIME, and goes on without it", () => {
    const { room, tick } = openRoom();
    const wait = Math.ceil(MAX_START_WAIT_TIME / STEP_SECONDS) + 1;
    for (let i = 0; i < wait + MAX_INPUT_DELAY_STEPS + 10; i++) tick();
    assert.ok(room.fight.steps >= 10, `${room.fight.steps} steps`);
  });

  test("runs each input on the step it was made for: its fight is the client's, hash for hash", () => {
    const { link, room, client, play } = openRoom();
    const hashes = new Map<number, number>();
    for (let step = 1; step <= 8 * HASH_EVERY_STEPS; step++) {
      play(script(step));
      hashes.set(client.fight.steps, client.fight.hash());
    }
    const sent = link.all("battleHash");
    assert.deepEqual(sent.map((m) => m.step), [1, 2, 3, 4, 5, 6, 7, 8].map((n) => n * HASH_EVERY_STEPS));
    for (const msg of sent) assert.equal(msg.hash, hashes.get(msg.step), `step ${msg.step}`);
    assert.deepEqual(room.fight.save(), client.fight.save());
  });

  test("never runs the fight ahead of its own clock, whatever the client says", () => {
    const { room, tick } = openRoom();
    const client = new FakeClient(setupWith());
    const inputs = Array.from({ length: 40 }, () => client.step(script(1))).flatMap((s) => s.inputs);
    room.input(0, 40, inputs.slice(0, 16));
    for (let i = 1; i <= 3; i++) {
      tick();
      assert.ok(room.fight.steps <= i, `tick ${i}: ${room.fight.steps} steps`);
    }
  });

  test("waits up to MAX_INPUT_DELAY_STEPS for a late input, and runs it on its own step", () => {
    const { room, client, play } = openRoom();
    play();
    const late = MAX_INPUT_DELAY_STEPS - 3;
    play(input({ attack: "light" }), late);
    for (let i = 0; i < late; i++) {
      assert.equal(room.fight.steps, 1, "held back, waiting for step 2");
      play(IDLE_INPUT);
    }
    for (let i = 0; i < 10; i++) play(IDLE_INPUT);
    assert.deepEqual(room.fight.save(), client.fight.save(), "the slash ran on step 2, as on the client");
  });

  test("an input later than that runs on the server's next step instead (the client is corrected)", () => {
    const { room, client, play } = openRoom();
    play();
    const late = MAX_INPUT_DELAY_STEPS + 3;
    play(input({ attack: "light" }), late);
    for (let i = 0; i < late + 10; i++) play(IDLE_INPUT);
    assert.notDeepEqual(room.fight.save(), client.fight.save());
    // Steps 2.. ran without it until it came, MAX_INPUT_DELAY_STEPS + 3 ticks late; it ran on the next one.
    const ranAt = 2 + late - MAX_INPUT_DELAY_STEPS;
    const expected = new Fight(setupWith());
    while (expected.steps < room.fight.steps) {
      expected.step([input({ attack: expected.steps + 1 === ranAt ? "light" : null })]);
    }
    assert.deepEqual(room.fight.save(), expected.save());
  });

  test("keeps inputs that come early and runs each on its own step: its fight stays the client's", () => {
    const { room, client, play, tick } = openRoom();
    play();
    // Its clock moved on for inputs that came as late as the server waits for, then the ping spike passed.
    for (let i = 0; i < MAX_INPUT_DELAY_STEPS; i++) {
      const sent = client.step(script(client.fight.steps + 1));
      room.input(0, sent.upTo, sent.inputs);
    }
    for (let i = 0; i < 2 * HASH_EVERY_STEPS; i++) play(script(client.fight.steps + 1));
    while (room.fight.steps < client.fight.steps) tick();
    assert.deepEqual(room.fight.save(), client.fight.save());
  });

  test("drops inputs for steps further ahead of its clock than MAX_INPUT_LEAD_STEPS", () => {
    const { room, play } = openRoom();
    play();
    const ahead = room.fight.steps + 1 + MAX_INPUT_LEAD_STEPS + 1;
    room.input(0, ahead, [{ step: ahead, ...input({ attack: "light" }) }]);
    while (room.fight.steps < ahead + 10) play(null);
    const idle = new Fight(setupWith());
    while (idle.steps < room.fight.steps) idle.step([IDLE_INPUT]);
    assert.deepEqual(room.fight.save(), idle.save());
  });

  test("a client gone silent: the fight goes on in real time, MAX_INPUT_DELAY_STEPS behind its clock", () => {
    const { room, play } = openRoom();
    play();
    for (let i = 0; i < 100; i++) play(null);
    assert.equal(room.fight.steps, 101 - MAX_INPUT_DELAY_STEPS);
  });

  test("says in every hash how late the player's inputs come", () => {
    const { link, play } = openRoom();
    for (let i = 0; i < HASH_EVERY_STEPS; i++) play();
    assert.equal(link.last("battleHash").lateSteps, 0);
    for (let i = 0; i < HASH_EVERY_STEPS * 4; i++) play(IDLE_INPUT, i < 4 ? 0 : 7);
    assert.ok(link.last("battleHash").lateSteps >= 6, `${link.last("battleHash").lateSteps}`);
  });

  test("asked to resync, sends its whole fight at its step; not again within MIN_SYNC_GAP_STEPS", () => {
    const { link, room, play } = openRoom();
    for (let i = 0; i < 20; i++) play(script(i + 1));
    room.resync(0);
    const sync = link.last("battleSync");
    assert.equal(sync.step, room.fight.steps);
    assert.deepEqual(sync.fight, room.fight.save());
    room.resync(0);
    assert.equal(link.all("battleSync").length, 1);
    for (let i = 0; i < MIN_SYNC_GAP_STEPS; i++) play();
    room.resync(0);
    assert.equal(link.all("battleSync").length, 2);
  });

  test("when it's won: a last battleSync with the whole fight at once, then the result; the arena stays open", () => {
    const { link, room, ended, play } = openRoom();
    play();
    room.fight.world.require(room.fight.enemies[0]!, Health).hp = 0;
    play();
    const last = link.last("battleSync");
    assert.equal(last.step, 2);
    assert.equal(last.fight.outcome.state, "won");
    assert.deepEqual(ended.map((e) => e.result), ["won"]);
    assert.deepEqual(ended[0]!.vitals, { hp: PLAYER.maxHp, stamina: PLAYER_STATS.stamina });
    assert.equal(room.over, false);
    assert.equal(room.afterFight, true);
    assert.equal(room.inArena(0), true);
  });

  test("after a win the fight runs on with the player's inputs and hashes, and the result isn't given again", () => {
    const { link, room, ended, client, play } = openRoom();
    play();
    room.fight.world.require(room.fight.enemies[0]!, Health).hp = 0;
    client.fight.world.require(client.fight.enemies[0]!, Health).hp = 0;
    for (let i = 0; i < HASH_EVERY_STEPS * 2 - 1; i++) play(script(i + 1));
    assert.equal(room.fight.steps, client.fight.steps);
    assert.equal(link.last("battleHash").step, client.fight.steps);
    assert.equal(link.last("battleHash").hash, client.fight.hash());
    assert.equal(ended.length, 1);
  });

  test("leaving the arena after a win isn't a loss: nothing more is said, and with nobody left it's freed", () => {
    const { link, room, ended, play } = openRoom();
    play();
    room.fight.world.require(room.fight.enemies[0]!, Health).hp = 0;
    play();
    room.leave(0);
    assert.deepEqual(ended.map((e) => e.result), ["won"]);
    assert.equal(room.inArena(0), false);
    assert.equal(room.over, true);
    const sent = link.sent.length;
    for (let i = 0; i < 10; i++) play();
    room.resync(0);
    assert.equal(link.sent.length, sent, "nothing after");
  });

  test("a loss frees the fight at once: nothing more is sent", () => {
    const { link, room, ended, play } = openRoom();
    play();
    room.fight.world.require(room.fight.players[0]!, Health).hp = 0;
    play();
    assert.deepEqual(ended.map((e) => e.result), ["lost"]);
    assert.equal(room.over, true);
    assert.equal(room.afterFight, false);
    assert.equal(room.inArena(0), false);
    const sent = link.sent.length;
    for (let i = 0; i < 10; i++) play();
    assert.equal(link.sent.length, sent);
  });

  test("the player's vitals at the end are the fight's", () => {
    const { room, ended, play } = openRoom();
    play();
    play(input({ attack: "light" }));
    for (let i = 0; i < 30; i++) play();
    const { hp } = Object.assign(room.fight.world.require(room.fight.players[0]!, Health), { hp: 37 });
    room.fight.world.require(room.fight.enemies[0]!, Health).hp = 0;
    play();
    assert.equal(ended[0]!.vitals.hp, hp);
    assert.ok(ended[0]!.vitals.stamina < PLAYER_STATS.stamina, "the slash cost stamina");
  });

  test("a player who leaves mid-fight is told at once how it ended for them; with nobody left, it's freed", () => {
    const { link, room, ended, play } = openRoom();
    for (let i = 0; i < 10; i++) play();
    const sent = link.sent.length;
    room.leave(0);
    assert.deepEqual(ended.map((e) => e.result), [LEAVING_LOSES ? "lost" : "left"]);
    assert.equal(room.over, true);
    play();
    assert.equal(link.sent.length, sent, "nothing more is sent to them");
  });

  test("a silent client still loses when the fight runs past MAX_FIGHT_TIME", () => {
    const { room, ended, play } = openRoom();
    play();
    room.fight.outcome.stateTime = MAX_FIGHT_TIME;
    for (let i = 0; i < MAX_INPUT_DELAY_STEPS + 2 && !room.over; i++) play(null);
    assert.deepEqual(ended.map((e) => e.result), ["lost"]);
  });
});
