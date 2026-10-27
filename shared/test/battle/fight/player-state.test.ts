import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { Body, Health, Player, Stamina, type Entity, type PlayerInputData } from "@infinite-tower/shared";
import { initPhysics, readPlayerState, writePlayerState, type Fight } from "@infinite-tower/shared/fight";
import { bodyOf, duel, IDLE, input, STATUE } from "./fixtures.js";

before(() => initPhysics());

const FAR_AWAY = { x: 0, y: 0.05, z: 7 };

function playerRow(fight: Fight, e: Entity) {
  const { pos, vel } = fight.world.require(e, Body);
  return {
    pos, vel, player: fight.world.require(e, Player), health: fight.world.require(e, Health),
    stamina: fight.world.require(e, Stamina),
  };
}

/** Steps `fight` through `inputs` and returns its one player's row after each step. */
function play(fight: Fight, inputs: PlayerInputData[]) {
  return inputs.map((next) => {
    fight.step([next]);
    return structuredClone(playerRow(fight, fight.players[0]!));
  });
}

describe("a player's state", () => {
  test("read from one fight and written into another (through JSON), plays on the same there", () => {
    const from = duel(STATUE, { x: 0, y: 0.05, z: -2 }, FAR_AWAY);
    const to = duel(STATUE, { x: 3, y: 2, z: -4 }, FAR_AWAY);
    // Mid-air and mid-swing, worn out a little, with a press buffered: every timer is running.
    play(from, [...Array(20).fill(input({ moveZ: 1, moveX: 0.5 })), input({ jump: true, attack: true })]);
    Object.assign(from.world.require(from.players[0]!, Health), { hp: 42, invuln: 0.2, flash: 0.05 });
    const state = JSON.parse(JSON.stringify(readPlayerState(from, from.players[0]!)));

    writePlayerState(to, to.players[0]!, state);
    assert.deepEqual(playerRow(to, to.players[0]!), playerRow(from, from.players[0]!));
    const after = [
      ...Array(30).fill(input({ jump: true })), ...Array(40).fill(IDLE), input({ dodge: true, moveX: 1 }),
      ...Array(30).fill(IDLE),
    ];
    assert.deepEqual(play(to, after), play(from, after));
  });

  test("is copied in, not shared with the fight", () => {
    const fight = duel(STATUE, { x: 0, y: 0.05, z: -2 }, FAR_AWAY);
    const state = readPlayerState(fight, fight.players[0]!);
    state.pos.x = 5;
    state.player.actionDir.x = 1;
    assert.notEqual(bodyOf(fight, fight.players[0]!).pos.x, 5);
    const other = duel(STATUE, { x: 0, y: 0.05, z: -2 }, FAR_AWAY);
    writePlayerState(other, other.players[0]!, state);
    state.pos.x = 1;
    assert.equal(bodyOf(other, other.players[0]!).pos.x, 5);
  });
});
