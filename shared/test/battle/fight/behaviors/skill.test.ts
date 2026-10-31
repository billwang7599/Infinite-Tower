import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Enemy, FIXED_DT, Health, PLAYER, SkillObject, Skilled, skillCost, Stamina, wordsOf, type EnemyDef, type Skill,
  type Vec3,
} from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import { ARENA, bodyOf, CASTER, casts, enemy, flatDist, IDLE, input, player, run } from "../fixtures.js";

before(() => initPhysics());

const at = (x: number, z: number): Vec3 => ({ x, y: 0.05, z });
const SKILL = CASTER.attacks.skill!;
const KEEP = CASTER.keepAway!;

const fightWith = (def: EnemyDef, gapM: number, seed = 1) => new Fight({
  arena: { ...ARENA, radius: 16 }, players: [player(at(0, -gapM / 2))], enemies: [{ ...enemy(def, at(0, gapM / 2)), seed }],
});
const them = (fight: Fight) => fight.enemies[0]!;
const gap = (fight: Fight) => flatDist(bodyOf(fight, fight.players[0]!).pos, bodyOf(fight, them(fight)).pos);
const stateOf = (fight: Fight) => fight.world.require(them(fight), Enemy).state;
const skilledOf = (fight: Fight) => fight.world.require(them(fight), Skilled);
const bolts = (fight: Fight) => [...fight.world.query(SkillObject)].filter(([, o]) => o.caster === them(fight));
const lostHp = (fight: Fight, e: number) => {
  const health = fight.world.require(e, Health);
  return health.max - health.hp;
};

function firstCast(fight: Fight, seconds = 6): Skill | null {
  for (let i = 0; i < seconds / FIXED_DT; i++) {
    fight.step([IDLE]);
    const casting = skilledOf(fight).casting;
    if (casting) return casting;
  }
  return null;
}

const NEVER_CASTS: EnemyDef = { ...CASTER, attacks: { skill: casts({ firstDelay: 999 }) } };

describe("keeping away", () => {
  test("from afar, it walks in only as far as its far edge", () => {
    const fight = fightWith(NEVER_CASTS, 14);
    run(fight, 8);
    assert.ok(gap(fight) < 14 - 3, `gap ${gap(fight)}`);
    assert.ok(gap(fight) > KEEP.farM - 0.5 && gap(fight) < KEEP.farM + 0.5, `gap ${gap(fight)}`);
  });

  test("up close, it backs away, facing you", () => {
    const fight = fightWith(NEVER_CASTS, 2.5);
    run(fight, 1.5);
    assert.ok(gap(fight) > 3.2, `gap ${gap(fight)}`);
    assert.ok(Math.cos(fight.world.require(them(fight), Enemy).yaw - Math.PI) > 0.9);
  });

  test("rushed while it chants, it backs away facing you, still chanting", () => {
    const fight = fightWith({ ...CASTER, attacks: { skill: casts({ quickCastM: 0, wordTime: 1 }) } }, 2);
    while (!skilledOf(fight).chanting) fight.step([IDLE]);
    const from = gap(fight);
    run(fight, 1.5);
    assert.equal(stateOf(fight), "skillChant");
    assert.ok(skilledOf(fight).words.length > 0);
    assert.ok(gap(fight) > from + 1, `gap ${from} -> ${gap(fight)}`);
    assert.ok(Math.cos(fight.world.require(them(fight), Enemy).yaw - Math.PI) > 0.9);
  });

  test("without keeping away, it stands while it chants", () => {
    const fight = fightWith({ ...CASTER, keepAway: undefined, attacks: { skill: casts({ quickCastM: 0 }) } }, 2);
    while (!skilledOf(fight).chanting) fight.step([IDLE]);
    const from = gap(fight);
    run(fight, SKILL.wordTime);
    assert.equal(stateOf(fight), "skillChant");
    assert.ok(Math.abs(gap(fight) - from) < 0.05, `gap ${from} -> ${gap(fight)}`);
  });

  test("between its edges, it stands", () => {
    const fight = fightWith(NEVER_CASTS, 5.5);
    run(fight, 2);
    assert.ok(Math.abs(gap(fight) - 5.5) < 0.2, `gap ${gap(fight)}`);
  });
});

describe("casting at the player", () => {
  test("within quick-cast range it casts at once, without chanting", () => {
    const fight = fightWith(CASTER, SKILL.quickCastM - 0.5);
    let chanted = false;
    for (let i = 0; i < 1 / FIXED_DT && !skilledOf(fight).casting; i++) {
      fight.step([IDLE]);
      chanted ||= skilledOf(fight).chanting;
    }
    assert.ok(!chanted);
    assert.equal(stateOf(fight), "skillCast");
    run(fight, 1);
    assert.ok(lostHp(fight, fight.players[0]!) > 0);
  });

  test("farther, it chants the skill a word at a time, then releases it", () => {
    const fight = fightWith(CASTER, SKILL.quickCastM + 2);
    const shown: number[] = [];
    let castAt = -1;
    for (let i = 0; i < 4 / FIXED_DT && castAt < 0; i++) {
      fight.step([IDLE]);
      const skilled = skilledOf(fight);
      if (skilled.chanting && shown.at(-1) !== skilled.words.length) shown.push(skilled.words.length);
      if (skilled.casting) castAt = i;
    }
    const words = wordsOf({ segments: [SKILL.skill] });
    assert.deepEqual(shown, [0, 1, 2]);
    assert.equal(words.length, 2);
    assert.ok(castAt > (words.length + 1) * SKILL.wordTime / FIXED_DT - 2, `cast at step ${castAt}`);
    run(fight, 1.5);
    assert.ok(lostHp(fight, fight.players[0]!) > 0);
  });

  test("beyond its range it doesn't cast", () => {
    const fight = fightWith({ ...NEVER_CASTS, attacks: { skill: casts({ rangeM: 6 }) } }, 14);
    run(fight, 0.5);
    assert.equal(stateOf(fight), "approach");
    assert.equal(skilledOf(fight).chanting, false);
  });

  test("a new cast waits for the last one's Bolt to be gone, then the cooldown", () => {
    const fight = fightWith(CASTER, 3);
    let flying = false, casting = false, starts = 0, goneAt = -1;
    for (let i = 0; i < 6 / FIXED_DT; i++) {
      fight.step([IDLE]);
      const nowCasting = skilledOf(fight).casting !== null;
      if (nowCasting && !casting) {
        assert.ok(!flying, `step ${i}`);
        if (goneAt >= 0) assert.ok(i - goneAt >= SKILL.cooldown / FIXED_DT - 1, `${i - goneAt} steps after`);
        starts++;
      }
      if (flying && bolts(fight).length === 0) goneAt = i;
      casting = nowCasting;
      flying = bolts(fight).length > 0;
    }
    assert.ok(starts >= 2);
  });

  test("its extra modifiers come from its seed: the same seed casts the same, and each turns up sometimes", () => {
    const def: EnemyDef = {
      ...CASTER,
      attacks: {
        skill: casts({ extras: [{ modifier: "follow", chance: 1 / 3 }, { modifier: "split", chance: 1 / 4 }] }),
      },
    };
    const casts20 = Array.from({ length: 20 }, (_, seed) => firstCast(fightWith(def, 3, seed + 1))!);
    assert.deepEqual(casts20, Array.from({ length: 20 }, (_, seed) => firstCast(fightWith(def, 3, seed + 1))));
    for (const cast of casts20) {
      assert.equal(cast.segments[0].form, "bolt");
      assert.deepEqual(cast.segments[0].elements, ["fire"]);
    }
    const mods = casts20.map((c) => c.segments[0].modifiers.join(" "));
    assert.ok(mods.includes(""), mods.join("|"));
    assert.ok(mods.some((m) => m.includes("follow")), mods.join("|"));
    assert.ok(mods.some((m) => m.includes("split")), mods.join("|"));
  });

  test("it pays its skills' stamina like a player, and gets it back the same way", () => {
    const fight = fightWith(CASTER, 3);
    const stamina = fight.world.require(them(fight), Stamina);
    assert.equal(stamina.max, CASTER.stats.stamina);
    const cast = firstCast(fight)!;
    while (skilledOf(fight).casting) fight.step([IDLE]);
    assert.equal(stamina.value, CASTER.stats.stamina - skillCost(cast));
    run(fight, PLAYER.staminaRegenDelay + 0.2);
    assert.ok(stamina.value > CASTER.stats.stamina - skillCost(cast));
  });

  test("short of stamina, it doesn't cast", () => {
    const tired: EnemyDef = { ...CASTER, stats: { ...CASTER.stats, stamina: 1 } };
    for (const gapM of [3, SKILL.quickCastM + 2]) {
      const fight = fightWith(tired, gapM);
      run(fight, 3);
      assert.equal(bolts(fight).length, 0);
      assert.equal(lostHp(fight, fight.players[0]!), 0);
    }
  });

  test("a stagger breaks its chant off: the words are lost and nothing is cast", () => {
    const fragile: EnemyDef = {
      ...CASTER, poise: 1, keepAway: undefined, attacks: { skill: casts({ quickCastM: 0 }) },
    };
    const fight = new Fight({
      arena: { ...ARENA, radius: 16 }, players: [player(at(0, 0))], enemies: [enemy(fragile, at(0, 1.6))],
    });
    while (!skilledOf(fight).chanting) fight.step([IDLE]);
    run(fight, SKILL.wordTime * 1.5);
    assert.ok(skilledOf(fight).words.length > 0);
    for (let i = 0; i < 0.5 / FIXED_DT && stateOf(fight) !== "staggered"; i++) {
      fight.step([input({ attack: i % 2 ? "light" : null })]);
    }
    assert.equal(stateOf(fight), "staggered");
    fight.step([IDLE]);
    assert.deepEqual(skilledOf(fight).words, []);
    assert.equal(skilledOf(fight).chanting, false);
    run(fight, fragile.staggerTime - 0.1);
    assert.equal(bolts(fight).length, 0);
  });

  test("its skills hurt by its skillpower", () => {
    const hurtBy = (skillpower: number) => {
      const fight = fightWith({ ...CASTER, stats: { ...CASTER.stats, skillpower } }, 3);
      run(fight, 2);
      return lostHp(fight, fight.players[0]!);
    };
    assert.equal(hurtBy(0), 0);
    assert.ok(hurtBy(10) > 0);
    assert.ok(Math.abs(hurtBy(20) - 2 * hurtBy(10)) < 1e-6);
  });
});
