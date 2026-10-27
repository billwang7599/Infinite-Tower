import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Body, Health, IDLE_INPUT, physicalDamage, PLAYER, type EnemyDef, type PlayerInputData, type Vitals,
} from "@infinite-tower/shared";
import {
  ENEMY_START, ENEMY_START_YAW, initPhysics, LEAVING_LOSES, MAX_FIGHT_TIME, PLAYER_START, readPlayerState,
  type FightSetup, type PlayerResult,
} from "@infinite-tower/shared/fight";
import { BattleRoom, MAX_START_WAIT_TIME, SNAPSHOT_EVERY_STEPS } from "../../../src/core/battle/room.js";
import { ENEMIES } from "../../../src/core/content/enemies.js";
import { PLAYER_STATS } from "../../../src/core/content/player.js";
import { FakeLink } from "../../fixtures/fakes.js";

before(() => initPhysics());

/** The wild boar, rooted to the spot and harmless. */
const STATUE: EnemyDef = { ...ENEMIES["wild-boar"], walkSpeed: 0, turnRate: 0, attacks: {} };
const STEP_SECONDS = 1 / 60;
const SLASH_DAMAGE = physicalDamage(PLAYER.slash.damage, PLAYER_STATS);

function setupWith(enemyAt = ENEMY_START): FightSetup {
  return {
    arena: { radius: 16 },
    players: [{ at: PLAYER_START, vitals: { hp: PLAYER.maxHp, stamina: PLAYER_STATS.stamina }, stats: PLAYER_STATS,
      burden: "light" }],
    enemies: [{ def: STATUE, at: enemyAt, yaw: ENEMY_START_YAW }],
  };
}

/** A room with one player on a FakeLink; `ended` records how the fight ended for them. */
function open(setup = setupWith()) {
  const link = new FakeLink();
  const ended: { result: PlayerResult; vitals: Vitals }[] = [];
  const room = new BattleRoom(setup, [{ link, onEnd: (result, vitals) => ended.push({ result, vitals }) }]);
  let seq = 0;
  /** One step: the player's input (if any), then the room's tick. */
  const play = (input: PlayerInputData | null = IDLE_INPUT) => {
    if (input) room.input(0, [{ seq: ++seq, ...input }]);
    room.tick();
  };
  return { link, room, ended, play };
}

describe("a battle room", () => {
  test("waits for the player's first input before the fight starts (they're still flashing into the arena)", () => {
    const { link, room, play } = open();
    for (let i = 0; i < 30; i++) play(null);
    assert.equal(link.all("battleState").length, 0);
    assert.equal(room.fight.outcome.stateTime, 0);
    play();
    assert.ok(room.fight.outcome.stateTime > 0);
  });

  test("starts without it after MAX_START_WAIT_TIME", () => {
    const { room, play } = open();
    for (let i = 0; i < Math.ceil(MAX_START_WAIT_TIME / STEP_SECONDS) + 1; i++) play(null);
    assert.ok(room.fight.outcome.stateTime > 0);
  });

  test("sends battleState every SNAPSHOT_EVERY_STEPS steps, with the last input it ran", () => {
    const { link, play } = open();
    for (let i = 0; i < SNAPSHOT_EVERY_STEPS * 4; i++) play();
    const states = link.all("battleState");
    assert.equal(states.length, 4);
    assert.deepEqual(states.map((s) => s.step), [1, 2, 3, 4].map((n) => n * SNAPSHOT_EVERY_STEPS));
    assert.deepEqual(states.map((s) => s.ack), states.map((s) => s.step));
    assert.ok(states.every((s) => s.repeats === 0 && s.outcome === "fighting"));
  });

  test("counts the steps it ran with no new input", () => {
    const { link, play } = open();
    play();
    for (let i = 1; i < SNAPSHOT_EVERY_STEPS; i++) play(null);
    const { ack, repeats } = link.last("battleState");
    assert.deepEqual({ ack, repeats }, { ack: 1, repeats: SNAPSHOT_EVERY_STEPS - 1 });
  });

  test("sends the player themselves exactly, everyone else rounded to the centimetre, their own seat empty", () => {
    const { link, room, play } = open();
    for (let i = 0; i < SNAPSHOT_EVERY_STEPS * 5; i++) play({ ...IDLE_INPUT, moveX: 0.3, moveZ: 0.9 });
    const state = link.last("battleState");
    assert.deepEqual(state.me, readPlayerState(room.fight, room.fight.players[0]!));
    assert.deepEqual(state.players, [null]);
    const boar = room.fight.world.require(room.fight.enemies[0]!, Body).pos;
    const sent = state.enemies[0]!;
    assert.ok(Math.abs(sent.x - boar.x) <= 0.005 && Math.abs(sent.z - boar.z) <= 0.005);
    assert.equal(sent.x, Math.round(sent.x * 100) / 100);
    assert.equal(sent.hp, STATUE.maxHp);
    assert.equal(sent.state, "approach");
  });

  test("sends what happened since the last state, fighters by index (players, then enemies)", () => {
    const close = { x: PLAYER_START.x, y: PLAYER_START.y, z: PLAYER_START.z + 2.5 };
    const { link, play } = open(setupWith(close));
    play();
    play({ ...IDLE_INPUT, attack: true });
    for (let i = 0; i < 20; i++) play();
    const events = link.all("battleState").flatMap((s) => s.events);
    assert.deepEqual(events, [{ type: "hit", target: 1, team: "enemy", damage: SLASH_DAMAGE }]);
  });

  test("when it's decided: a last battleState at once, then the result; the fight is freed", () => {
    const { link, room, ended, play } = open();
    play();
    room.fight.world.require(room.fight.enemies[0]!, Health).hp = 0;
    play();
    assert.equal(link.last("battleState").outcome, "won");
    assert.equal(link.last("battleState").step, 2, "not waiting for the next round of states");
    assert.equal(ended.length, 1);
    assert.equal(ended[0]!.result, "won");
    assert.deepEqual(ended[0]!.vitals, { hp: PLAYER.maxHp, stamina: PLAYER_STATS.stamina });
    assert.equal(room.over, true);
    const sent = link.sent.length;
    for (let i = 0; i < 10; i++) play();
    assert.equal(link.sent.length, sent, "nothing after");
    assert.equal(ended.length, 1);
  });

  test("the player's vitals at the end are the fight's", () => {
    const { room, ended, play } = open();
    play({ ...IDLE_INPUT, attack: true });
    for (let i = 0; i < 30; i++) play();
    const { hp } = Object.assign(room.fight.world.require(room.fight.players[0]!, Health), { hp: 37 });
    room.fight.world.require(room.fight.enemies[0]!, Health).hp = 0;
    play();
    assert.equal(ended[0]!.vitals.hp, hp);
    assert.ok(ended[0]!.vitals.stamina < PLAYER_STATS.stamina, "the slash cost stamina");
  });

  test("a player who leaves mid-fight is told at once how it ended for them; with nobody left, it's freed", () => {
    const { link, room, ended, play } = open();
    for (let i = 0; i < 10; i++) play();
    const sent = link.sent.length;
    room.leave(0);
    assert.deepEqual(ended.map((e) => e.result), [LEAVING_LOSES ? "lost" : "left"]);
    assert.equal(room.over, true);
    play();
    assert.equal(link.sent.length, sent, "nothing more is sent to them");
  });

  test("a fight that runs past MAX_FIGHT_TIME ends as a loss", () => {
    const { room, ended, play } = open();
    play();
    room.fight.outcome.stateTime = MAX_FIGHT_TIME;
    play();
    assert.deepEqual(ended.map((e) => e.result), ["lost"]);
  });
});
