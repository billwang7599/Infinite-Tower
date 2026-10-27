import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Body, Enemy, Health, PLAYER, Player, Stamina, type Entity, type PlayerInputData,
} from "@infinite-tower/shared";
import { initPhysics, type Fight } from "@infinite-tower/shared/fight";
import { BOAR, bodyOf, duel, flatDist, IDLE, input, STATUE } from "./fixtures.js";

before(() => initPhysics());

const PLAYER_AT = { x: 0, y: 0.05, z: -2 };
/** Out of everyone's way. */
const FAR_AWAY = { x: 0, y: 0.05, z: 7 };

const repeat = (steps: number, step: PlayerInputData): PlayerInputData[] => Array.from({ length: steps }, () => step);

/** Walk, jump, two chained slashes, a dodge to the side, a backstep, standing about in between. */
const SCRIPT: PlayerInputData[] = [
  ...repeat(20, input({ moveZ: 1 })),
  ...repeat(10, input({ moveZ: 1, jump: true })),
  ...repeat(40, IDLE),
  input({ attack: true }), ...repeat(17, IDLE), input({ attack: true }), ...repeat(30, IDLE),
  input({ moveX: 1, dodge: true }), ...repeat(25, input({ moveX: 1 })), ...repeat(30, IDLE),
  input({ aimX: 0.6, aimZ: 0.8, dodge: true }), ...repeat(40, IDLE),
];

/** Everything about a player that their own steps change. */
function playerRow(fight: Fight, e: Entity) {
  const { pos, vel } = fight.world.require(e, Body);
  return {
    pos, vel, player: fight.world.require(e, Player), health: fight.world.require(e, Health),
    stamina: fight.world.require(e, Stamina),
  };
}

describe("predicting one player", () => {
  test("gives them exactly what the fight's own steps give them, step for step", () => {
    const server = duel(STATUE, PLAYER_AT, FAR_AWAY), client = duel(STATUE, PLAYER_AT, FAR_AWAY);
    for (const [step, next] of SCRIPT.entries()) {
      server.step([next]);
      client.predict(client.players[0]!, next);
      assert.deepEqual(playerRow(client, client.players[0]!), playerRow(server, server.players[0]!), `step ${step}`);
    }
  });

  test("moves nobody else, lands no hit and decides nothing", () => {
    const fight = duel(BOAR, PLAYER_AT, { x: 0, y: 0.05, z: 0 });
    const boar = fight.enemies[0]!, me = fight.players[0]!;
    const before = { pos: { ...bodyOf(fight, boar).pos }, enemy: structuredClone(fight.world.require(boar, Enemy)) };
    for (let step = 0; step < 120; step++) fight.predict(me, input({ attack: step % 2 === 0 }));
    assert.equal(fight.world.require(me, Player).action, "slash", "the player swung");
    assert.equal(fight.world.require(boar, Health).hp, BOAR.maxHp);
    assert.deepEqual(bodyOf(fight, boar).pos, before.pos);
    assert.deepEqual(fight.world.require(boar, Enemy), before.enemy);
    assert.deepEqual(fight.outcome, { state: "fighting", stateTime: 0 });
  });

  test("an enemy where the client put it still stands in the player's way", () => {
    const fight = duel(STATUE, PLAYER_AT, FAR_AWAY);
    const statue = bodyOf(fight, fight.enemies[0]!), me = fight.players[0]!;
    Object.assign(statue.pos, { x: 0, z: PLAYER_AT.z + 3 });
    fight.physics.place(statue.collider, statue.pos);
    for (let step = 0; step < 90; step++) fight.predict(me, input({ moveZ: 1 }));
    const touching = PLAYER.radius + STATUE.radius;
    assert.ok(flatDist(bodyOf(fight, me).pos, statue.pos) > touching - 0.03, "never walked into it");
    assert.ok(bodyOf(fight, me).pos.z > PLAYER_AT.z + 1, "but walked up to it");
  });

  test("runs down the player's hit timers, as the fight's steps do", () => {
    const fight = duel(STATUE, PLAYER_AT, FAR_AWAY);
    const health = fight.world.require(fight.players[0]!, Health);
    Object.assign(health, { invuln: 0.5, hitstun: 0.3, flash: 0.05 });
    for (let step = 0; step < 6; step++) fight.predict(fight.players[0]!, IDLE);
    assert.ok(Math.abs(health.invuln - (0.5 - 6 / 60)) < 1e-9);
    assert.ok(Math.abs(health.hitstun - (0.3 - 6 / 60)) < 1e-9);
    assert.equal(health.flash, 0, "and stop at 0");
  });
});
