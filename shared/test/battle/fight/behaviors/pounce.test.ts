import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Body, Enemy, FIXED_DT, Health, Stamina, type EnemyState, type PlayerInputData, type Vec3,
} from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import { ARENA, enemy, FULL_HP, FULL_STAMINA, IDLE, input, player, WOLF } from "../fixtures.js";

before(() => initPhysics());

const at = (x: number, z: number): Vec3 => ({ x, y: 0.05, z });
const ME = at(0, 0), THEM = at(0, 4.5);
const POUNCE = WOLF.attacks.pounce!;

const fightWith = (seed = 1) =>
  new Fight({ arena: ARENA, players: [player(ME)], enemies: [{ ...enemy(WOLF, THEM), seed }] });
const wolf = (fight: Fight) => fight.world.require(fight.enemies[0]!, Enemy);
const wolfAt = (fight: Fight) => fight.world.require(fight.enemies[0]!, Body).pos;
const meAt = (fight: Fight) => fight.world.require(fight.players[0]!, Body).pos;
const hp = (fight: Fight) => fight.world.require(fight.players[0]!, Health).hp;
const gap = (fight: Fight) => Math.hypot(wolfAt(fight).x - meAt(fight).x, wolfAt(fight).z - meAt(fight).z);

const facing = (fight: Fight, over: Partial<PlayerInputData> = {}): PlayerInputData => {
  const w = wolfAt(fight), me = meAt(fight), d = Math.hypot(w.x - me.x, w.z - me.z) || 1;
  return input({ aimX: (w.x - me.x) / d, aimZ: (w.z - me.z) / d, ...over });
};

const MAX_WAIT_TIME = POUNCE.firstDelay + POUNCE.cooldownSpread + POUNCE.windup + 1;

function stepUntil(
  fight: Fight, state: EnemyState, next: (fight: Fight) => PlayerInputData = () => IDLE, seconds = MAX_WAIT_TIME,
): void {
  for (let i = 0; i < seconds / FIXED_DT && wolf(fight).state !== state; i++) fight.step([next(fight)]);
  assert.equal(wolf(fight).state, state, `never got to ${state}`);
}

describe("the grey wolf's pounce", () => {
  test("it circles at its distance before its first leap, going round rather than in", () => {
    const fight = fightWith();
    const startYaw = Math.atan2(THEM.x, THEM.z);
    for (let i = 0; i < (POUNCE.firstDelay - 0.1) / FIXED_DT; i++) {
      fight.step([IDLE]);
      assert.equal(wolf(fight).state, "approach");
    }
    assert.ok(Math.abs(gap(fight) - POUNCE.circleM) < 1, `${gap(fight)} m away`);
    const w = wolfAt(fight), turned = Math.abs(Math.atan2(w.x, w.z) - startYaw);
    assert.ok(turned > 0.3, `went ${turned} rad round`);
  });

  test("walked up to, it backs off to its distance instead of biting at once", () => {
    const fight = fightWith();
    for (let i = 0; i < (POUNCE.firstDelay - 0.1) / FIXED_DT; i++) {
      const toward = facing(fight);
      fight.step([{ ...toward, moveX: toward.aimX, moveZ: toward.aimZ }]);
      assert.equal(wolf(fight).state, "approach");
    }
    assert.ok(gap(fight) > POUNCE.circleM / 2, `${gap(fight)} m away`);
  });

  test("it winds up, leaps and bites a player who stands there", () => {
    const fight = fightWith();
    stepUntil(fight, "pounceWindup");
    stepUntil(fight, "pounce");
    stepUntil(fight, "pounceRecover");
    assert.equal(hp(fight), FULL_HP - POUNCE.damage);
  });

  test("its wind-up tracks a player stepping aside, then locks its line before it leaps", () => {
    const fight = fightWith();
    stepUntil(fight, "pounceWindup");
    const yaws: number[] = [];
    while (wolf(fight).state === "pounceWindup") {
      yaws.push(wolf(fight).yaw);
      fight.step([input({ moveX: 1 })]);
    }
    const lockSteps = Math.round(POUNCE.lockAt / FIXED_DT);
    const locked = yaws.slice(-lockSteps);
    assert.ok(locked.every((yaw) => yaw === locked[0]), "locked");
    assert.notEqual(yaws[1], locked[0], "tracked before the lock");
  });

  test("stepping aside during the wind-up makes the leap miss", () => {
    const fight = fightWith();
    stepUntil(fight, "pounceWindup");
    stepUntil(fight, "pounceRecover", () => input({ moveX: 1 }));
    assert.equal(hp(fight), FULL_HP);
  });

  test("a dodge as it leaps beats the bite", () => {
    const fight = fightWith();
    stepUntil(fight, "pounce");
    stepUntil(fight, "pounceRecover", (f) => input({ dodge: gap(f) < 2.5 }));
    assert.equal(hp(fight), FULL_HP);
  });

  test("a held block takes the bite on stamina, with no HP lost", () => {
    const fight = fightWith();
    stepUntil(fight, "pounceRecover", (f) => facing(f, { block: true }));
    assert.equal(hp(fight), FULL_HP);
    assert.ok(fight.world.require(fight.players[0]!, Stamina).value < FULL_STAMINA);
  });

  test("after the bite it stands a moment, open, then hops back out and circles again", () => {
    const fight = fightWith();
    stepUntil(fight, "pounceRecover");
    let recoverSteps = 0;
    while (wolf(fight).state === "pounceRecover") { fight.step([IDLE]); recoverSteps++; }
    assert.ok(Math.abs(recoverSteps - POUNCE.recover / FIXED_DT) <= 1, `${recoverSteps} steps`);
    assert.equal(wolf(fight).state, "pounceHop");
    const before = gap(fight);
    stepUntil(fight, "approach");
    assert.ok(gap(fight) - before > POUNCE.hopSpeed * POUNCE.hopTime * 0.6, `${before} m to ${gap(fight)} m`);
  });

  test("a leap that meets nobody leaves it open longer than one that's taken or blocked", () => {
    const openFor = (next: (fight: Fight) => PlayerInputData) => {
      const fight = fightWith();
      stepUntil(fight, "pounceWindup");
      stepUntil(fight, "pounceRecover", next);
      let steps = 0;
      while (wolf(fight).state === "pounceRecover") { fight.step([IDLE]); steps++; }
      return steps * FIXED_DT;
    };
    const missed = openFor(() => input({ moveX: 1 })), taken = openFor(() => IDLE);
    const blocked = openFor((f) => facing(f, { block: true }));
    assert.ok(Math.abs(missed - POUNCE.missRecover) <= FIXED_DT, `${missed} s`);
    assert.ok(Math.abs(taken - POUNCE.recover) <= FIXED_DT && Math.abs(blocked - POUNCE.recover) <= FIXED_DT);
  });

  test("it can't be staggered while it commits, only once it's back to circling", () => {
    const fight = fightWith();
    stepUntil(fight, "pounceWindup");
    wolf(fight).poise = 0;
    fight.step([IDLE]);
    assert.equal(wolf(fight).state, "pounceWindup");
    stepUntil(fight, "approach");
    wolf(fight).poise = 0;
    fight.step([IDLE]);
    assert.equal(wolf(fight).state, "staggered");
  });

  test("how long it circles comes from its seed", () => {
    const leapsAt = (seed: number) => {
      const fight = fightWith(seed);
      stepUntil(fight, "pounceWindup");
      return fight.steps;
    };
    const steps = [1, 2, 3, 4, 5, 6].map(leapsAt);
    assert.ok(new Set(steps).size > 1, `${steps}`);
    assert.ok(steps.every((s) => s * FIXED_DT >= POUNCE.firstDelay), `${steps}`);
  });

  test("its state survives a save and load: the two fights go on alike", () => {
    const original = fightWith(7);
    stepUntil(original, "pounceHop");
    const copy = fightWith(7);
    copy.load(JSON.parse(JSON.stringify(original.save())));
    for (let i = 0; i < 300; i++) {
      original.step([IDLE]);
      copy.step([IDLE]);
    }
    assert.equal(copy.hash(), original.hash());
  });
});
