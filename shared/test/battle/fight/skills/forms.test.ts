import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  Body, releaseTime, FIXED_DT, Health, SKILL_EFFECTS, Player, SKILL, SkillObject, skillCost, Stamina, Statuses,
  type AttackKind, type EnemyDef, type Skill, type Vec3,
} from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import { ARENA, castNow, enemy, IDLE, input, player, run, segment, skill, STATUE } from "../fixtures.js";

await initPhysics();

const D = SKILL_EFFECTS.damage, W = SKILL_EFFECTS.elements.water.damage;
const ME: Vec3 = { x: 0, y: 0.05, z: -4 };
const at = (x: number, z: number): Vec3 => ({ x, y: 0.05, z });

function fightWith(enemies: Vec3[], book: (Skill | null)[] = [null, null, null, null], def: EnemyDef = STATUE): Fight {
  return new Fight({ arena: ARENA, players: [player(ME, { book })], enemies: enemies.map((e) => enemy(def, e)) });
}
const lostHp = (fight: Fight, i: number) => {
  const health = fight.world.require(fight.enemies[i]!, Health);
  return health.max - health.hp;
};
const me = (fight: Fight) => fight.players[0]!;
const objects = (fight: Fight, kind?: string) =>
  [...fight.world.query(SkillObject)].filter(([, o]) => kind === undefined || o.kind === kind);
const close = (actual: number, expected: number, message?: string) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${message ?? ""} ${actual} != ${expected}`);

describe("a Form with no element", () => {
  test("hits for plain damage, with no status", () => {
    const fight = fightWith([at(0, 0)]);
    castNow(fight, skill(segment("bolt")));
    run(fight, 1);
    close(lostHp(fight, 0), SKILL_EFFECTS.plain.damage * D);
    const s = fight.world.require(fight.enemies[0]!, Statuses);
    assert.deepEqual(s.on, []);
  });
});

describe("a skill's release", () => {
  test("a Bolt or a Beam reports it, with its elements and where its caster stands, as the other Forms do", () => {
    for (const form of ["bolt", "beam"] as const) {
      const fight = fightWith([at(0, 6)]), cast = skill(segment(form, ["fire"]));
      const released: unknown[] = [], spawnedAt: Vec3[] = [];
      fight.step([input({ chant: true })]);
      fight.step([input({ cast })]);
      for (let i = 0; i < Math.round(releaseTime(cast) / FIXED_DT) + 2; i++) {
        fight.step([IDLE]);
        const now = fight.events.filter((e) => e.type === "skill");
        released.push(...now);
        if (now.length > 0) spawnedAt.push({ ...fight.world.require(me(fight), Body).pos });
      }
      assert.equal(released.length, 1, form);
      assert.deepEqual(released[0], { type: "skill", form, elements: ["fire"], at: spawnedAt[0] }, form);
    }
  });
});

describe("a Beam", () => {
  const BEAM_WATER = skill(segment("beam", ["water"]));
  const beamTicks = 1 + Math.round(SKILL_EFFECTS.beam.time / SKILL_EFFECTS.beam.tickTime);

  test("strikes the first enemy on its line as it starts and every tick for its time", () => {
    const fight = fightWith([at(0, 0), at(0, 3)]);
    castNow(fight, BEAM_WATER);
    assert.equal(objects(fight, "beam").length, 1);
    run(fight, SKILL_EFFECTS.beam.time + 0.5);
    assert.equal(objects(fight, "beam").length, 0);
    close(lostHp(fight, 0), beamTicks * SKILL_EFFECTS.beam.tickShare * W * D);
    assert.equal(lostHp(fight, 1), 0);
  });

  test("locked on, it streams at the target whichever way the input aims", () => {
    const fight = fightWith([at(4, 0)]);
    castNow(fight, BEAM_WATER, { locked: 0 });
    run(fight, SKILL_EFFECTS.beam.time + 0.5, () => input({ locked: 0 }));
    close(lostHp(fight, 0), beamTicks * SKILL_EFFECTS.beam.tickShare * W * D);
  });

  test("doesn't reach past its range", () => {
    const B = SKILL_EFFECTS.beam;
    const fight = new Fight({
      arena: { ...ARENA, radius: 20 }, players: [player(ME)],
      enemies: [enemy(STATUE, at(0, ME.z + B.rangeM + STATUE.radius + B.radiusM + 0.3))],
    });
    castNow(fight, BEAM_WATER);
    run(fight, SKILL_EFFECTS.beam.time + 0.5);
    assert.equal(lostHp(fight, 0), 0);
  });

  test("held, it lasts while the cast is held, paying its own words' cost a second, then its time", () => {
    const fight = fightWith([at(0, 0)], [BEAM_WATER, null, null, null]);
    const stamina = fight.world.require(me(fight), Stamina);
    const before = stamina.value;
    const holdSeconds = 1.5;
    const holding = (step: number) => input(step === 0 ? { cast: BEAM_WATER } : { castHeld: true });
    run(fight, releaseTime(BEAM_WATER) + holdSeconds, holding);
    assert.equal(fight.world.require(me(fight), Player).action, "beam");
    const perSecond = (SKILL.cost.form + SKILL.cost.element) * SKILL_EFFECTS.beam.heldCostFactor;
    assert.ok(Math.abs(before - stamina.value - skillCost(BEAM_WATER) - perSecond * holdSeconds) < perSecond * 0.1);
    run(fight, SKILL_EFFECTS.beam.time - 0.1);
    assert.equal(objects(fight, "beam").length, 1, "its time runs from the release");
    run(fight, 0.2);
    assert.equal(objects(fight, "beam").length, 0);
    assert.equal(fight.world.require(me(fight), Player).action, "none");
  });

  test("a dodge ends it at once, with no hand-off", () => {
    const fight = fightWith([at(0, 0), at(2, 1)]);
    castNow(fight, skill(segment("beam", ["water"]), segment("nova", ["fire"])));
    fight.step([input({ dodge: true, moveX: -1 })]);
    assert.equal(objects(fight, "beam").length, 0);
    run(fight, 1);
    assert.equal(lostHp(fight, 1), 0);
  });

  test("hands off where it ends: at the first enemy on its line", () => {
    const fight = fightWith([at(0, 0), at(2, 1)]);
    castNow(fight, skill(segment("beam", ["water"]), segment("nova", ["earth"])));
    run(fight, SKILL_EFFECTS.beam.time + 0.2);
    close(lostHp(fight, 1), SKILL_EFFECTS.elements.earth.damage * D);
  });
});

describe("Imbue", () => {
  const reachM = 1.6;
  const swings = (fight: Fight, count: number) => {
    for (let i = 0; i < count; i++) {
      const attack: AttackKind = i % 2 === 0 ? "light" : "heavy";
      run(fight, 0.9, (step) => input({ attack: step === 0 ? attack : null }));
    }
  };
  const swordFight = () => new Fight({
    arena: ARENA, players: [player(at(0, 0))],
    enemies: [enemy({ ...STATUE, maxHp: 10_000 }, at(0, reachM)), enemy(STATUE, at(3, 3))],
  });

  test("the next sword hits also strike with its elements, for its hits", () => {
    const imbued = swordFight(), plain = swordFight();
    castNow(imbued, skill(segment("imbue", ["water"])));
    castNow(plain, skill(segment("self")));
    swings(imbued, SKILL_EFFECTS.imbue.hits + 1);
    swings(plain, SKILL_EFFECTS.imbue.hits + 1);
    assert.ok(lostHp(plain, 0) > 0, "the swings land");
    close(lostHp(imbued, 0) - lostHp(plain, 0), SKILL_EFFECTS.imbue.hits * SKILL_EFFECTS.imbue.share * W * D);
    assert.equal(objects(imbued, "imbue").length, 0);
  });

  test("runs out after its time", () => {
    const fight = swordFight();
    castNow(fight, skill(segment("imbue", ["water"])));
    run(fight, SKILL_EFFECTS.imbue.time + 0.1);
    assert.equal(objects(fight, "imbue").length, 0);
  });

  test("hands off from the enemy its last hit landed on", () => {
    const fight = swordFight();
    castNow(fight, skill(segment("imbue", ["water"]), segment("nova", ["earth"])));
    swings(fight, SKILL_EFFECTS.imbue.hits);
    close(lostHp(fight, 1), SKILL_EFFECTS.elements.earth.damage * D);
  });
});

describe("a lingering Nova (Extend)", () => {
  test("leaves a cloud that strikes again every tick for its time", () => {
    const fight = fightWith([at(0, -2)]);
    castNow(fight, skill(segment("nova", ["water"], ["extend"])));
    assert.equal(objects(fight, "cloud").length, 1);
    run(fight, SKILL_EFFECTS.cloud.time + 0.2);
    assert.equal(objects(fight, "cloud").length, 0);
    const ticks = Math.round(SKILL_EFFECTS.cloud.time / SKILL_EFFECTS.cloud.tickTime);
    close(lostHp(fight, 0), W * D * (1 + ticks * SKILL_EFFECTS.cloud.tickShare));
  });

  test(`a player has at most ${SKILL_EFFECTS.objects.perPlayer} clouds: a new one ends their oldest`, () => {
    const fight = fightWith([at(6, 6)]);
    const lingering = skill(segment("nova", [], ["extend", "extend", "extend"]));
    for (let i = 0; i < SKILL_EFFECTS.objects.perPlayer + 2; i++) {
      fight.world.require(me(fight), Stamina).value = 100;
      castNow(fight, lingering);
      fight.step([IDLE]);
      assert.ok(objects(fight, "cloud").length <= SKILL_EFFECTS.objects.perPlayer);
    }
    assert.equal(objects(fight, "cloud").length, SKILL_EFFECTS.objects.perPlayer);
  });
});

describe("skill objects in the fight's state", () => {
  test("a Beam, a cloud and an Imbue saved and loaded into another fight go on the same", () => {
    const make = () => fightWith([at(0, 0), at(1, -3)]);
    const a = make();
    castNow(a, skill(segment("imbue", ["fire"])));
    castNow(a, skill(segment("nova", ["water"], ["extend"])));
    castNow(a, skill(segment("beam", ["earth"])));
    a.step([IDLE]);
    const b = make();
    b.load(JSON.parse(JSON.stringify(a.save())));
    assert.equal(b.hash(), a.hash());
    for (let i = 0; i < Math.round(2 / FIXED_DT); i++) { a.step([IDLE]); b.step([IDLE]); }
    assert.equal(b.hash(), a.hash());
    assert.equal(lostHp(b, 0), lostHp(a, 0));
  });
});
