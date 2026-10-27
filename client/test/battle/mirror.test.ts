import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Body, Enemy, FIXED_DT, Health, PLAYER, type EnemySnap, type EnemyState, type ServerMsgOf,
} from "@infinite-tower/shared";
import { ENEMY_START_YAW, Fight, initPhysics, readPlayerState, type FightSetup } from "@infinite-tower/shared/fight";
import { FightMirror, INTERPOLATION_DELAY_STEPS } from "../../src/battle/mirror.js";

before(() => initPhysics());

const STATS = { stamina: 100, mana: 50, spellpower: 10, agility: 10, strength: 10 };
const SETUP: FightSetup = {
  arena: { radius: 16 },
  players: [{
    at: { x: 0, y: 0.05, z: -4 }, vitals: { hp: PLAYER.maxHp, stamina: 100 }, stats: STATS, burden: "light",
  }],
  enemies: [{
    def: {
      id: "boar", name: "Boar", model: "boar", maxHp: 100, stats: STATS, radius: 0.85, walkSpeed: 3, turnRate: 3,
      poise: 1000, poiseRegen: 0, staggerTime: 1, attacks: {},
    },
    at: { x: 0, y: 0.05, z: 6 }, yaw: ENEMY_START_YAW,
  }],
};
/** Steps between the server's states, as it sends them. */
const EVERY = 3;

/** The enemy as the server would send it at `step`: walking along x at 6 m/s. */
function boarAt(step: number, over: Partial<EnemySnap> = {}): EnemySnap {
  return {
    x: step * 0.1, y: 0.85, z: 6, vx: 6, vy: 0, vz: 0, hp: 100, flash: 0, yaw: 1, state: "approach",
    stateTime: step * FIXED_DT, ...over,
  };
}

function setup() {
  const fight = new Fight(SETUP);
  const mirror = new FightMirror(fight, 0);
  const state = (step: number, boar: EnemySnap): ServerMsgOf<"battleState"> => ({
    t: "battleState", step, ack: 0, repeats: 0, outcome: "fighting", events: [], players: [null], enemies: [boar],
    me: readPlayerState(fight, fight.players[0]!),
  });
  const boar = () => ({
    body: fight.world.require(fight.enemies[0]!, Body), enemy: fight.world.require(fight.enemies[0]!, Enemy),
    health: fight.world.require(fight.enemies[0]!, Health),
  });
  /** Local steps from `from` to `to`, a state arriving every EVERY steps as the server sends them. */
  const run = (from: number, to: number, snap: (step: number) => EnemySnap = boarAt) => {
    for (let step = from; step <= to; step++) {
      if (step % EVERY === 0) mirror.push(state(step, snap(step)));
      mirror.step();
    }
  };
  return { fight, mirror, boar, run };
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

describe("the mirror of everyone else", () => {
  test("draws an enemy INTERPOLATION_DELAY_STEPS behind the newest state, between the two around then", () => {
    const { boar, run } = setup();
    run(1, 60);
    const drawnStep = 60 - INTERPOLATION_DELAY_STEPS;
    assert.ok(near(boar().body.pos.x, drawnStep * 0.1), `x ${boar().body.pos.x}, expected ${drawnStep * 0.1}`);
    assert.ok(near(boar().body.vel.x, 6));
    assert.ok(near(boar().enemy.stateTime, drawnStep * FIXED_DT));
  });

  test("moves the enemy's collider with it (it blocks your prediction where it's drawn)", () => {
    const { fight, boar, run } = setup();
    run(1, 30);
    const collider = fight.physics.position(boar().body.collider), drawn = boar().body.pos;
    // Rapier keeps positions in 32-bit floats.
    for (const axis of ["x", "y", "z"] as const) assert.ok(Math.abs(collider[axis] - drawn[axis]) < 1e-5, axis);
  });

  test("holds at the newest state when no more come, rather than guessing ahead", () => {
    const { boar, run, mirror } = setup();
    run(1, 30);
    for (let i = 0; i < 30; i++) mirror.step();
    assert.ok(near(boar().body.pos.x, 3));
  });

  test("held at the last state (the fight's over), its clocks run on: a hit's flash runs out", () => {
    const { boar, run, mirror } = setup();
    run(1, 30, (step) => boarAt(step, step === 30 ? { hp: 0, flash: 0.12 } : {}));
    for (let i = 0; i < 30; i++) mirror.step();
    assert.equal(boar().health.hp, 0);
    assert.equal(boar().health.flash, 0);
    assert.ok(boar().enemy.stateTime > 30 * FIXED_DT);
  });

  test("changes state (and HP) when the drawn moment reaches the state that has it", () => {
    const { boar, run } = setup();
    const hurtFrom = 30;
    const snap = (step: number) => (step < hurtFrom ? boarAt(step) : boarAt(step, {
      state: "staggered" as EnemyState, stateTime: (step - hurtFrom) * FIXED_DT, hp: 70, flash: 0.1,
    }));
    run(1, hurtFrom + INTERPOLATION_DELAY_STEPS - 1, snap);
    assert.deepEqual([boar().enemy.state, boar().health.hp], ["approach", 100]);
    run(hurtFrom + INTERPOLATION_DELAY_STEPS, hurtFrom + INTERPOLATION_DELAY_STEPS + 2, snap);
    assert.deepEqual([boar().enemy.state, boar().health.hp], ["staggered", 70]);
    assert.ok(boar().health.flash > 0);
  });

  test("turns the short way round between two yaws", () => {
    const { boar, run } = setup();
    // Drawn a third of the way from 3.1 to -3.1 rad: across the back (about π), not round through the front (0).
    run(1, 31 + INTERPOLATION_DELAY_STEPS, (step) => boarAt(step, { yaw: step <= 30 ? 3.1 : -3.1 }));
    assert.ok(Math.cos(boar().enemy.yaw) < -0.99, `yaw ${boar().enemy.yaw}`);
  });

  test("leaves your own fighter alone (that's the prediction's)", () => {
    const { fight, run } = setup();
    const before = readPlayerState(fight, fight.players[0]!);
    run(1, 30);
    assert.deepEqual(readPlayerState(fight, fight.players[0]!), before);
  });
});
