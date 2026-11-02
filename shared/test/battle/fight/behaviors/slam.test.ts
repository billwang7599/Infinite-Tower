import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Body, Enemy, FIXED_DT, Health, PLAYER, Stamina, type EnemyState, type PlayerInputData, type Vec3,
} from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import { ARENA, enemy, FULL_HP, FULL_STAMINA, IDLE, input, LURKER, player } from "../fixtures.js";

before(() => initPhysics());

const at = (x: number, z: number): Vec3 => ({ x, y: 0.05, z });
const ME = at(0, 0);
const SLAM = LURKER.attacks.slam!, SWEEP = SLAM.sweep;

const fightWith = (them = at(0, 2.5), yaw = Math.PI, seed = 1) =>
  new Fight({ arena: ARENA, players: [player(ME)], enemies: [{ ...enemy(LURKER, them, yaw), seed }] });
const lurker = (fight: Fight) => fight.world.require(fight.enemies[0]!, Enemy);
const hp = (fight: Fight) => fight.world.require(fight.players[0]!, Health).hp;
const stamina = (fight: Fight) => fight.world.require(fight.players[0]!, Stamina).value;
const meAt = (fight: Fight) => fight.world.require(fight.players[0]!, Body).pos;
const lurkerAt = (fight: Fight) => fight.world.require(fight.enemies[0]!, Body).pos;

const facing = (fight: Fight, over: Partial<PlayerInputData> = {}): PlayerInputData => {
  const it = lurkerAt(fight), me = meAt(fight), d = Math.hypot(it.x - me.x, it.z - me.z) || 1;
  return input({ aimX: (it.x - me.x) / d, aimZ: (it.z - me.z) / d, ...over });
};

const MAX_WAIT_TIME = SLAM.firstDelay + SLAM.windup + SLAM.recover + SLAM.cooldown + 1;

function stepUntil(
  fight: Fight, state: EnemyState, next: (fight: Fight) => PlayerInputData = () => IDLE, seconds = MAX_WAIT_TIME,
): void {
  for (let i = 0; i < seconds / FIXED_DT && lurker(fight).state !== state; i++) fight.step([next(fight)]);
  assert.equal(lurker(fight).state, state, `never got to ${state}`);
}

describe("the bog lurker's slam and sweep", () => {
  test("in reach in front, it rises and slams a player who stands there, shaking the ground", () => {
    const fight = fightWith();
    stepUntil(fight, "slamWindup");
    let slammed = false;
    for (let i = 0; i < MAX_WAIT_TIME / FIXED_DT && lurker(fight).state !== "slamRecover"; i++) {
      fight.step([IDLE]);
      slammed ||= fight.events.some((ev) => ev.type === "slam");
    }
    assert.equal(hp(fight), FULL_HP - SLAM.damage);
    assert.ok(slammed);
  });

  test("its rise is slow: the slam lands only a whole wind-up after it starts", () => {
    const fight = fightWith();
    stepUntil(fight, "slamWindup");
    let steps = 0;
    while (lurker(fight).state === "slamWindup") { fight.step([IDLE]); steps++; }
    assert.ok(Math.abs(steps * FIXED_DT - SLAM.windup) <= FIXED_DT, `${steps} steps`);
  });

  test("it turns toward a player stepping aside as it rises, then holds its line before it slams", () => {
    const fight = fightWith();
    stepUntil(fight, "slamWindup");
    const yaws: number[] = [];
    while (lurker(fight).state === "slamWindup") {
      yaws.push(lurker(fight).yaw);
      fight.step([input({ moveX: 0.4 })]);
    }
    const locked = yaws.slice(-Math.round(SLAM.lockAt / FIXED_DT));
    assert.ok(locked.every((yaw) => yaw === locked[0]), "locked");
    assert.notEqual(yaws[1], locked[0], "turned before the lock");
  });

  test("a dodge as it comes down beats the slam", () => {
    const fight = fightWith();
    stepUntil(fight, "slamWindup");
    stepUntil(fight, "slamRecover", (f) => input({ moveZ: -1, dodge: lurker(f).stateTime > SLAM.windup - 0.1 }));
    assert.equal(hp(fight), FULL_HP);
  });

  test("so does backing out of its reach once its line is locked", () => {
    const fight = fightWith();
    stepUntil(fight, "slamWindup");
    stepUntil(fight, "slamRecover", (f) => input({ moveZ: lurker(f).stateTime > SLAM.windup - SLAM.lockAt ? -1 : 0 }));
    assert.equal(hp(fight), FULL_HP);
  });

  test("a held block takes it with no HP lost, but costs its whole damage in stamina, more than a dodge", () => {
    const fight = fightWith();
    stepUntil(fight, "slamRecover", (f) => facing(f, { block: true }));
    assert.equal(hp(fight), FULL_HP);
    assert.ok(FULL_STAMINA - stamina(fight) >= SLAM.damage, `${stamina(fight)} left`);
    assert.ok(SLAM.damage > PLAYER.dodge.cost);
  });

  test("it can't be staggered while it rises or slams, only once it stands open after", () => {
    const fight = fightWith();
    stepUntil(fight, "slamWindup");
    lurker(fight).poise = 0;
    fight.step([IDLE]);
    assert.equal(lurker(fight).state, "slamWindup");
    stepUntil(fight, "slamRecover");
    lurker(fight).poise = 0;
    fight.step([IDLE]);
    assert.equal(lurker(fight).state, "staggered");
  });

  test("after a slam it stands open for its recovery, then walks again", () => {
    const fight = fightWith();
    stepUntil(fight, "slamRecover");
    let steps = 0;
    while (lurker(fight).state === "slamRecover") { fight.step([IDLE]); steps++; }
    assert.ok(Math.abs(steps * FIXED_DT - SLAM.recover) <= FIXED_DT, `${steps} steps`);
    assert.equal(lurker(fight).state, "approach");
  });

  test("a player behind it in reach gets its tail swept round instead", () => {
    const fight = fightWith(at(0, 2), 0);
    stepUntil(fight, "sweepWindup");
    stepUntil(fight, "sweepRecover");
    assert.equal(hp(fight), FULL_HP - SWEEP.damage);
  });

  test("a dodge beats the sweep too", () => {
    const fight = fightWith(at(0, 2), 0);
    stepUntil(fight, "sweepWindup");
    stepUntil(fight, "sweepRecover", (f) => input({ moveZ: -1, dodge: lurker(f).stateTime > SWEEP.windup - 0.1 }));
    assert.equal(hp(fight), FULL_HP);
  });

  test("a player in front gets the slam, never the sweep", () => {
    const fight = fightWith();
    const seen = new Set<EnemyState>();
    for (let i = 0; i < 2 * MAX_WAIT_TIME / FIXED_DT; i++) {
      fight.step([IDLE]);
      seen.add(lurker(fight).state);
    }
    assert.ok(seen.has("slam") && !seen.has("sweepWindup"), [...seen].join());
  });

  test("its state survives a save and load: the two fights go on alike", () => {
    const original = fightWith();
    stepUntil(original, "slamRecover");
    const copy = fightWith();
    copy.load(JSON.parse(JSON.stringify(original.save())));
    for (let i = 0; i < 300; i++) {
      original.step([IDLE]);
      copy.step([IDLE]);
    }
    assert.equal(copy.hash(), original.hash());
  });
});
