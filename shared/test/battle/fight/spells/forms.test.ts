import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  castTime, FIXED_DT, Health, MAGIC, Player, SPELL, SpellObject, spellCost, Stamina, Statuses, type AttackKind,
  type EnemyDef, type Spell, type Vec3,
} from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import { ARENA, castNow, enemy, IDLE, input, player, run, segment, spell, STATUE } from "../fixtures.js";

await initPhysics();

const D = MAGIC.damage, W = MAGIC.elements.water.damage;
const ME: Vec3 = { x: 0, y: 0.05, z: -4 };
const at = (x: number, z: number): Vec3 => ({ x, y: 0.05, z });

function fightWith(enemies: Vec3[], book: (Spell | null)[] = [null, null, null, null], def: EnemyDef = STATUE): Fight {
  return new Fight({ arena: ARENA, players: [player(ME, { book })], enemies: enemies.map((e) => enemy(def, e)) });
}
const lostHp = (fight: Fight, i: number) => {
  const health = fight.world.require(fight.enemies[i]!, Health);
  return health.max - health.hp;
};
const me = (fight: Fight) => fight.players[0]!;
const objects = (fight: Fight, kind?: string) =>
  [...fight.world.query(SpellObject)].filter(([, o]) => kind === undefined || o.kind === kind);
const close = (actual: number, expected: number, message?: string) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${message ?? ""} ${actual} != ${expected}`);

describe("a Form with no element", () => {
  test("hits for plain damage, with no status", () => {
    const fight = fightWith([at(0, 0)]);
    castNow(fight, spell(segment("bolt")));
    run(fight, 1);
    close(lostHp(fight, 0), MAGIC.plain.damage * D);
    const s = fight.world.require(fight.enemies[0]!, Statuses);
    assert.ok(Object.values(s.left).every((left) => left === 0));
  });
});

describe("a Beam", () => {
  const BEAM_WATER = spell(segment("beam", ["water"]));
  const beamTicks = 1 + Math.round(MAGIC.beam.time / MAGIC.beam.tickTime);

  test("strikes the first enemy on its line as it starts and every tick for its time", () => {
    const fight = fightWith([at(0, 0), at(0, 3)]);
    castNow(fight, BEAM_WATER);
    assert.equal(objects(fight, "beam").length, 1);
    run(fight, MAGIC.beam.time + 0.5);
    assert.equal(objects(fight, "beam").length, 0);
    close(lostHp(fight, 0), beamTicks * MAGIC.beam.tickShare * W * D);
    assert.equal(lostHp(fight, 1), 0);
  });

  test("doesn't reach past its range", () => {
    const fight = new Fight({
      arena: { radius: 20 }, players: [player(ME)],
      enemies: [enemy(STATUE, at(0, ME.z + MAGIC.beam.rangeM + STATUE.radius + MAGIC.beam.radiusM + 0.3))],
    });
    castNow(fight, BEAM_WATER);
    run(fight, MAGIC.beam.time + 0.5);
    assert.equal(lostHp(fight, 0), 0);
  });

  test("held, it lasts while the cast is held, paying its own words' cost a second, then its time", () => {
    const fight = fightWith([at(0, 0)], [BEAM_WATER, null, null, null]);
    const stamina = fight.world.require(me(fight), Stamina);
    const before = stamina.value;
    const holdSeconds = 1.5;
    const holding = (step: number) => input(step === 0 ? { cast: BEAM_WATER } : { castHeld: true });
    run(fight, castTime(BEAM_WATER) + holdSeconds, holding);
    assert.equal(fight.world.require(me(fight), Player).action, "beam");
    const perSecond = (SPELL.cost.form + SPELL.cost.element) * MAGIC.beam.heldCostFactor;
    assert.ok(Math.abs(before - stamina.value - spellCost(BEAM_WATER) - perSecond * holdSeconds) < perSecond * 0.1);
    run(fight, MAGIC.beam.time - 0.1);
    assert.equal(objects(fight, "beam").length, 1, "its time runs from the release");
    run(fight, 0.2);
    assert.equal(objects(fight, "beam").length, 0);
    assert.equal(fight.world.require(me(fight), Player).action, "none");
  });

  test("a dodge ends it at once, with no hand-off", () => {
    const fight = fightWith([at(0, 0), at(2, 1)]);
    castNow(fight, spell(segment("beam", ["water"]), segment("nova", ["fire"])));
    fight.step([input({ dodge: true, moveX: -1 })]);
    assert.equal(objects(fight, "beam").length, 0);
    run(fight, 1);
    assert.equal(lostHp(fight, 1), 0);
  });

  test("hands off where it ends: at the first enemy on its line", () => {
    const fight = fightWith([at(0, 0), at(2, 1)]);
    castNow(fight, spell(segment("beam", ["water"]), segment("nova", ["earth"])));
    run(fight, MAGIC.beam.time + 0.2);
    close(lostHp(fight, 1), MAGIC.elements.earth.damage * D);
  });
});

describe("Imbue", () => {
  const reachM = 1.6;
  const swings = (fight: Fight, count: number) => {
    for (let i = 0; i < count; i++) {
      const attack: AttackKind = i % 2 === 0 ? "lr" : "rl";
      run(fight, 0.9, (step) => input({ attack: step === 0 ? attack : null }));
    }
  };
  const swordFight = () => new Fight({
    arena: ARENA, players: [player(at(0, 0))], enemies: [enemy(STATUE, at(0, reachM)), enemy(STATUE, at(3, 3))],
  });

  test("the next sword hits also strike with its elements, for its hits", () => {
    const imbued = swordFight(), plain = swordFight();
    castNow(imbued, spell(segment("imbue", ["water"])));
    castNow(plain, spell(segment("self")));
    swings(imbued, MAGIC.imbue.hits + 1);
    swings(plain, MAGIC.imbue.hits + 1);
    assert.ok(lostHp(plain, 0) > 0, "the swings land");
    close(lostHp(imbued, 0) - lostHp(plain, 0), MAGIC.imbue.hits * MAGIC.imbue.share * W * D);
    assert.equal(objects(imbued, "imbue").length, 0);
  });

  test("runs out after its time", () => {
    const fight = swordFight();
    castNow(fight, spell(segment("imbue", ["water"])));
    run(fight, MAGIC.imbue.time + 0.1);
    assert.equal(objects(fight, "imbue").length, 0);
  });

  test("hands off from the enemy its last hit landed on", () => {
    const fight = swordFight();
    castNow(fight, spell(segment("imbue", ["water"]), segment("nova", ["earth"])));
    swings(fight, MAGIC.imbue.hits);
    close(lostHp(fight, 1), MAGIC.elements.earth.damage * D);
  });
});

describe("a lingering Nova (Extend)", () => {
  test("leaves a cloud that strikes again every tick for its time", () => {
    const fight = fightWith([at(0, -2)]);
    castNow(fight, spell(segment("nova", ["water"], ["extend"])));
    assert.equal(objects(fight, "cloud").length, 1);
    run(fight, MAGIC.cloud.time + 0.2);
    assert.equal(objects(fight, "cloud").length, 0);
    const ticks = Math.round(MAGIC.cloud.time / MAGIC.cloud.tickTime);
    close(lostHp(fight, 0), W * D * (1 + ticks * MAGIC.cloud.tickShare));
  });

  test(`a player has at most ${MAGIC.objects.perPlayer} clouds: a new one ends their oldest`, () => {
    const fight = fightWith([at(6, 6)]);
    const lingering = spell(segment("nova", [], ["extend", "extend", "extend"]));
    for (let i = 0; i < MAGIC.objects.perPlayer + 2; i++) {
      fight.world.require(me(fight), Stamina).value = 100;
      castNow(fight, lingering);
      fight.step([IDLE]);
      assert.ok(objects(fight, "cloud").length <= MAGIC.objects.perPlayer);
    }
    assert.equal(objects(fight, "cloud").length, MAGIC.objects.perPlayer);
  });
});

describe("spell objects in the fight's state", () => {
  test("a Beam, a cloud and an Imbue saved and loaded into another fight go on the same", () => {
    const make = () => fightWith([at(0, 0), at(1, -3)]);
    const a = make();
    castNow(a, spell(segment("imbue", ["fire"])));
    castNow(a, spell(segment("nova", ["water"], ["extend"])));
    castNow(a, spell(segment("beam", ["earth"])));
    a.step([IDLE]);
    const b = make();
    b.load(JSON.parse(JSON.stringify(a.save())));
    assert.equal(b.hash(), a.hash());
    for (let i = 0; i < Math.round(2 / FIXED_DT); i++) { a.step([IDLE]); b.step([IDLE]); }
    assert.equal(b.hash(), a.hash());
    assert.equal(lostHp(b, 0), lostHp(a, 0));
  });
});
