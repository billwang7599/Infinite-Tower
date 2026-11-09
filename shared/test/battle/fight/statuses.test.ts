import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  applyStatus, BASE_STATS, damageTotal, Health, Stamina, STATUS_DEFS, Statuses, strikeDamage, timeLeft, WEAPONS,
  type StatusOn, type Vec3,
} from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import { ARENA, BITER, enemy, FULL_HP, IDLE, input, player, run, STATUE, swingTime } from "./fixtures.js";

await initPhysics();

const at = (x: number, z: number): Vec3 => ({ x, y: 0.05, z });
const close = (actual: number, expected: number, within = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < within, `${actual} vs ${expected}`);
const alone = () => new Fight({ arena: ARENA, players: [player(at(0, 0))], enemies: [enemy(STATUE, at(0, 6))] });
const mine = (fight: Fight): StatusOn[] => fight.world.require(fight.players[0]!, Statuses).on;

describe("statuses in a fight", () => {
  test("run down with time and come off at zero", () => {
    const fight = alone();
    applyStatus(mine(fight), "empowered", 0.5);
    run(fight, 0.25);
    close(timeLeft(mine(fight), "empowered"), 0.25, 0.02);
    run(fight, 0.3);
    assert.equal(mine(fight).length, 0);
  });

  test("a permanent one never runs down", () => {
    const fight = alone();
    applyStatus(mine(fight), "hasted", null);
    run(fight, 3);
    assert.equal(timeLeft(mine(fight), "hasted"), Infinity);
  });

  test("a heal over time heals its amount a second", () => {
    const fight = alone();
    const health = fight.world.require(fight.players[0]!, Health);
    health.hp = 50;
    applyStatus(mine(fight), "renewal", 4, 3);
    run(fight, 1);
    close(health.hp, 53, 0.1);
  });

  test("a shield that's used up comes off", () => {
    const fight = new Fight({ arena: ARENA, players: [player(at(0, -1))], enemies: [enemy(BITER, at(0, 1.5))] });
    applyStatus(mine(fight), "shielded", 6, 1);
    for (let i = 0; i < 300 && fight.world.require(fight.players[0]!, Health).hp === FULL_HP; i++) {
      fight.step([IDLE]);
    }
    assert.equal(timeLeft(mine(fight), "shielded"), 0);
  });

  test("are part of the fight's state and hash", () => {
    const a = alone(), b = alone();
    applyStatus(mine(a), "frenzy", 10);
    assert.notEqual(a.hash(), b.hash());
    b.load(JSON.parse(JSON.stringify(a.save())));
    assert.equal(a.hash(), b.hash());
    assert.deepEqual(mine(b), mine(a));
  });

  test("a permanent status's stats work through the same rules as a timed one's (an inscription, later)", () => {
    const swing = (time: number | null | undefined) => {
      const fight = new Fight({ arena: ARENA, players: [player(at(0, 0))], enemies: [enemy(STATUE, at(0, 1.4))] });
      if (time !== undefined) applyStatus(mine(fight), "frenzy", time);
      const stamina = fight.world.require(fight.players[0]!, Stamina);
      const before = stamina.value;
      fight.step([input({ attack: "light" })]);
      const spent = before - stamina.value;
      run(fight, swingTime());
      return { spent, dealt: STATUE.maxHp - fight.world.require(fight.enemies[0]!, Health).hp };
    };
    const plain = swing(undefined), timed = swing(10), permanent = swing(null);
    const F = STATUS_DEFS.frenzy.mods;
    assert.ok(plain.dealt >= damageTotal(strikeDamage(WEAPONS.sword, "light", 1, BASE_STATS)));
    close(timed.dealt, plain.dealt * F.damageDealtFactor);
    close(timed.spent, plain.spent * F.attackCostFactor);
    assert.deepEqual(permanent, timed);
  });
});
