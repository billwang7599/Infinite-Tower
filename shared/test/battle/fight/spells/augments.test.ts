import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  Health, MAGIC, MAX_LIVE_SHOTS, Player, shotOf, SpellObject, Statuses,
  type Augment, type Form, type SpellElement, type Vec3,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ARENA, castNow, enemy, IDLE, input, player, run, segment, spell, STATUE } from "../fixtures.js";

await initPhysics();

const D = MAGIC.damage, W = MAGIC.elements.water.damage, A = MAGIC.augments;
const ME: Vec3 = { x: 0, y: 0.05, z: -4 };
const at = (x: number, z: number): Vec3 => ({ x, y: 0.05, z });

const fightWith = (enemies: Vec3[], radius = ARENA.radius) =>
  new Fight({ arena: { radius }, players: [player(ME)], enemies: enemies.map((e) => enemy(STATUE, e)) });
const lostHp = (fight: Fight, i: number) => {
  const health = fight.world.require(fight.enemies[i]!, Health);
  return health.max - health.hp;
};
const objects = (fight: Fight, kind: string) => [...fight.world.query(SpellObject)].filter(([, o]) => o.kind === kind);
const one = (form: Form, elements: SpellElement[], augments: Augment[]) => spell(segment(form, elements, augments));
const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
const untilDone = (fight: Fight) => {
  for (let i = 0; i < 240 && objects(fight, "bolt").length > 0; i++) fight.step([IDLE]);
};

describe("augments, in order", () => {
  const shot = (...augments: Augment[]) => shotOf(segment("bolt", [], augments));
  const B = MAGIC.bolt;

  test("a repeat is a full step, applied again to the shot so far", () => {
    close(shot().delayTime, 0);
    close(shot("delay", "swift", "delay").delayTime, A.delayTime * 2);
    close(shot("amplify", "amplify").damageFactor, (1 + A.amplify) ** 2);
    close(shot("swift", "swift", "swift").swiftFactor, (1 + A.swift) ** 3);
  });

  test("each changes the shot built before it: Amplify then Split amplifies both Bolts", () => {
    const amplified = shot("amplify", "split");
    assert.equal(amplified.bolts, 2);
    close(amplified.damageFactor, (1 + A.amplify) * B.splitDamageFactor);
  });

  test("Split then Split splits each Bolt again", () => {
    const twice = shot("split", "split");
    assert.equal(twice.bolts, 4);
    close(twice.boltRadiusM, B.radiusM * B.splitRadiusFactor ** 2);
  });

  test("the first Extend leaves a cloud, each after it makes it last longer", () => {
    close(shotOf(segment("nova", [], ["extend"])).cloudTime, MAGIC.cloud.time);
    close(shotOf(segment("nova", [], ["extend", "extend"])).cloudTime, MAGIC.cloud.time * (1 + A.extend));
  });

  test("Follow then Split: every split Bolt homes", () => {
    close(shot("follow", "split").followTurnRadPerSec, A.followTurnRadPerSec);
  });
});

describe("Amplify", () => {
  test("adds damage, again in full with each repeat", () => {
    for (const augments of [["amplify"], ["amplify", "amplify"]] as Augment[][]) {
      const fight = fightWith([at(0, 0)]);
      castNow(fight, one("bolt", ["water"], augments));
      untilDone(fight);
      close(lostHp(fight, 0), W * D * (1 + A.amplify) ** augments.length);
    }
  });
});

describe("Widen", () => {
  test("a wider Nova reaches what a plain one can't", () => {
    const beyond = at(0, ME.z + MAGIC.nova.radius + STATUE.radius + 0.4);
    const plain = fightWith([beyond]), wide = fightWith([beyond]);
    castNow(plain, one("nova", ["water"], []));
    castNow(wide, one("nova", ["water"], ["widen"]));
    assert.equal(lostHp(plain, 0), 0);
    close(lostHp(wide, 0), W * D);
  });

  test("a wider Beam hits what passes beside a plain one", () => {
    const beside = at(STATUE.radius + MAGIC.beam.radiusM + 0.1, 0);
    const plain = fightWith([beside]), wide = fightWith([beside]);
    castNow(plain, one("beam", ["water"], []));
    castNow(wide, one("beam", ["water"], ["widen"]));
    assert.equal(lostHp(plain, 0), 0);
    assert.ok(lostHp(wide, 0) > 0);
  });
});

describe("Pierce", () => {
  test(`a Bolt goes through ${A.pierceTargets} enemies and stops in the next`, () => {
    const fight = fightWith([at(0, -2), at(0, 0), at(0, 2), at(0, 4)]);
    castNow(fight, one("bolt", ["water"], ["pierce"]));
    untilDone(fight);
    const hits = [0, 1, 2, 3].map((i) => lostHp(fight, i) > 0);
    assert.deepEqual(hits, [0, 1, 2, 3].map((i) => i <= A.pierceTargets));
  });

  test("a Beam strikes every enemy on its line, up to as many", () => {
    const fight = fightWith([at(0, -2), at(0, 0)]);
    castNow(fight, one("beam", ["water"], ["pierce"]));
    run(fight, 0.1);
    assert.ok(lostHp(fight, 0) > 0);
    assert.ok(lostHp(fight, 1) > 0);
  });
});

describe("Split", () => {
  const B = MAGIC.bolt;
  const splits = (n: number): Augment[] => Array.from({ length: n }, () => "split");
  const spellHits = (fight: Fight) => {
    const hits: number[] = [];
    for (let i = 0; i < 240 && objects(fight, "bolt").length > 0; i++) {
      fight.step([IDLE]);
      for (const e of fight.events) if (e.type === "hit" && !e.sword && e.team === "enemy") hits.push(e.damage);
    }
    return hits;
  };

  test("each Split doubles the Bolts", () => {
    for (let n = 0; 2 ** n <= MAX_LIVE_SHOTS; n++) {
      const fight = fightWith([at(5, 5)]);
      castNow(fight, one("bolt", ["water"], splits(n)));
      assert.equal(objects(fight, "bolt").length, 2 ** n, `${n} Splits`);
    }
  });

  test(`a fight holds at most ${MAX_LIVE_SHOTS} shots: past that, they don't spawn`, () => {
    const fight = fightWith([at(5, 5)]);
    castNow(fight, spell(segment("bolt", ["water"], splits(20)), segment("bolt", [], splits(10))));
    assert.equal(objects(fight, "bolt").length, MAX_LIVE_SHOTS);
    for (let i = 0; i < 240 && objects(fight, "bolt").length > 0; i++) {
      fight.step([IDLE]);
      assert.ok(objects(fight, "bolt").length <= MAX_LIVE_SHOTS);
    }
  });

  test("each Split makes every Bolt smaller and deal less", () => {
    for (const n of [1, 2, 3]) {
      const fight = fightWith([at(0, -2)]);
      castNow(fight, one("bolt", ["water"], splits(n)));
      for (const [, o] of objects(fight, "bolt")) close(o.reachM, B.radiusM * B.splitRadiusFactor ** n);
      const hits = spellHits(fight);
      assert.ok(hits.length > 0);
      for (const damage of hits) close(damage, W * D * B.splitDamageFactor ** n);
    }
  });

  test("Amplify strengthens every Bolt, wherever it's written", () => {
    const orders = [["amplify", "split", "split"], ["split", "amplify", "split"], ["split", "split", "amplify"]];
    for (const augments of orders) {
      const fight = fightWith([at(0, -2)]);
      castNow(fight, one("bolt", ["water"], augments as Augment[]));
      const hits = spellHits(fight);
      assert.ok(hits.length > 0);
      for (const damage of hits) close(damage, W * D * (1 + A.amplify) * B.splitDamageFactor ** 2);
    }
  });

  test("Follow homes every Bolt, wherever it's written", () => {
    for (const augments of [["follow", "split", "split"], ["split", "split", "follow"]]) {
      const fight = fightWith([at(0, 2)]);
      castNow(fight, one("bolt", ["water"], augments as Augment[]), { aimX: 0.6, aimZ: 0.8 });
      assert.equal(spellHits(fight).length, 4);
    }
  });

  test("the Bolts fan out by the Split step, sharing the widest fan once they'd pass it", () => {
    for (const n of [1, 2, 5]) {
      const fight = fightWith([at(5, 5)]);
      castNow(fight, one("bolt", ["water"], splits(n)));
      const yaws = objects(fight, "bolt").map(([, o]) => Math.atan2(o.dir.x, o.dir.z)).sort((a, b) => a - b);
      const stepRad = Math.min(B.splitSpreadRad, B.splitFanMaxRad / (yaws.length - 1));
      for (let i = 1; i < yaws.length; i++) close(yaws[i]! - yaws[i - 1]!, stepRad);
      assert.ok(yaws.at(-1)! - yaws[0]! <= B.splitFanMaxRad + 1e-9);
    }
  });

  test("the Bolts start side by side, two radii apart, sharing the widest row once they'd pass it", () => {
    for (const n of [1, 2, 5, 7]) {
      const fight = fightWith([at(5, 5)]);
      fight.step([input({ chant: true })]);
      const cast = one("bolt", ["water"], splits(n));
      for (let i = 0; objects(fight, "bolt").length === 0; i++) fight.step([input({ cast: i === 0 ? cast : null })]);
      const bolts = objects(fight, "bolt").map(([, o]) => o).sort((a, b) => a.pos.x - b.pos.x);
      for (let i = 1; i < bolts.length; i++) {
        const [a, b] = [bolts[i - 1]!, bolts[i]!];
        const apartM = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
        const gapM = Math.min(B.splitGapRadii * a.reachM, B.splitRowMaxM / (bolts.length - 1));
        assert.ok(apartM >= gapM - 1e-9, `${n} Splits: ${apartM} < ${gapM}`);
      }
    }
  });

  test("every Bolt hands off", () => {
    const fight = fightWith([at(0, 4)]);
    const novas: FightEvent[] = [];
    castNow(fight, spell(segment("bolt", ["water"], ["split"]), segment("nova")));
    for (let i = 0; i < 240 && objects(fight, "bolt").length > 0; i++) {
      fight.step([IDLE]);
      novas.push(...fight.events.filter((e) => e.type === "spell" && e.form === "nova"));
    }
    assert.equal(novas.length, 2);
  });
});

describe("Swift", () => {
  test("a Bolt flies faster", () => {
    const plain = fightWith([at(0, 7)]), swift = fightWith([at(0, 7)]);
    castNow(plain, one("bolt", ["water"], []));
    castNow(swift, one("bolt", ["water"], ["swift"]));
    const flown = (f: Fight) => objects(f, "bolt")[0]![1].flownM;
    close(flown(swift) / flown(plain), 1 + A.swift);
  });

  test("an Imbue's swings start quicker", () => {
    const plain = fightWith([at(5, 5)]), swift = fightWith([at(5, 5)]);
    castNow(plain, one("imbue", ["fire"], []));
    castNow(swift, one("imbue", ["fire"], ["swift"]));
    for (const f of [plain, swift]) f.step([input({ attack: "lr" })]);
    const startup = (f: Fight) => f.world.require(f.players[0]!, Player).startup;
    close(startup(swift), startup(plain) / (1 + A.swift));
  });
});

describe("Extend", () => {
  test("Self's statuses last longer", () => {
    const plain = fightWith([at(5, 5)]), long = fightWith([at(5, 5)]);
    castNow(plain, one("self", ["fire"], []));
    castNow(long, one("self", ["fire"], ["extend"]));
    const left = (f: Fight) => f.world.require(f.players[0]!, Statuses).left.empowered;
    close(left(long), left(plain) + MAGIC.self.fire.time * A.extend);
  });

  test("an Imbue holds more hits", () => {
    const fight = fightWith([at(5, 5)]);
    castNow(fight, one("imbue", ["fire"], ["extend"]));
    assert.equal(objects(fight, "imbue")[0]![1].hitsLeft, Math.round(MAGIC.imbue.hits * (1 + A.extend)));
  });

  test("a Beam lasts longer", () => {
    const fight = fightWith([at(5, 5)]);
    castNow(fight, one("beam", ["water"], ["extend"]));
    run(fight, MAGIC.beam.time * (1 + A.extend) - 0.1);
    assert.equal(objects(fight, "beam").length, 1);
    run(fight, 0.2);
    assert.equal(objects(fight, "beam").length, 0);
  });
});

describe("Delay", () => {
  test("holds back the hand-off after its segment completes", () => {
    const fight = fightWith([at(0, 0)]);
    castNow(fight, spell(segment("bolt", ["water"], ["delay"]), segment("nova", ["earth"])));
    untilDone(fight);
    run(fight, A.delayTime - 0.1);
    close(lostHp(fight, 0), W * D);
    run(fight, 0.2);
    close(lostHp(fight, 0), (W + MAGIC.elements.earth.damage) * D);
  });
});

describe("Follow", () => {
  const AWAY = { aimX: 0.6, aimZ: 0.8 };

  test("aimed away, a Bolt homes onto the nearest enemy when nothing is locked", () => {
    const plain = fightWith([at(0, 2)]), homing = fightWith([at(0, 2)]);
    castNow(plain, one("bolt", ["water"], []), AWAY);
    castNow(homing, one("bolt", ["water"], ["follow"]), AWAY);
    untilDone(plain);
    untilDone(homing);
    assert.equal(lostHp(plain, 0), 0);
    close(lostHp(homing, 0), W * D);
  });

  test("it homes onto the locked enemy, not the nearest", () => {
    const enemies = [at(-3, -2), at(3, 2)];
    const unlocked = fightWith(enemies), locked = fightWith(enemies);
    castNow(unlocked, one("bolt", ["water"], ["follow"]));
    castNow(locked, one("bolt", ["water"], ["follow"]), { locked: 1 });
    untilDone(unlocked);
    untilDone(locked);
    assert.ok(lostHp(unlocked, 0) > 0 && lostHp(unlocked, 1) === 0, "the nearest");
    assert.ok(lostHp(locked, 1) > 0 && lostHp(locked, 0) === 0, "the locked one");
  });
});
