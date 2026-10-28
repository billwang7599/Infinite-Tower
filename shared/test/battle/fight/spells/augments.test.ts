import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  augmentStrength, Health, MAGIC, Player, SpellObject, Statuses, type Augment, type Form, type SpellElement, type Vec3,
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

describe("repeating an augment", () => {
  test("gives 100%, then 50%, then 25%", () => {
    assert.equal(augmentStrength([], "amplify"), 0);
    assert.equal(augmentStrength(["amplify"], "amplify"), 1);
    assert.equal(augmentStrength(["amplify", "swift", "amplify"], "amplify"), 1.5);
    assert.equal(augmentStrength(["amplify", "amplify", "amplify"], "amplify"), 1.75);
  });
});

describe("Amplify", () => {
  test("adds damage, less with each repeat", () => {
    for (const augments of [["amplify"], ["amplify", "amplify"]] as Augment[][]) {
      const fight = fightWith([at(0, 0)]);
      castNow(fight, one("bolt", ["water"], augments));
      untilDone(fight);
      close(lostHp(fight, 0), W * D * (1 + A.amplify * augmentStrength(augments, "amplify")));
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
  test(`fires ${1 + A.splitBolts} Bolts in a fan, each at a share of the damage, each handing off`, () => {
    const fight = fightWith([at(0, 4)]);
    const novas: FightEvent[] = [];
    castNow(fight, spell(segment("bolt", ["water"], ["split"]), segment("nova")));
    assert.equal(objects(fight, "bolt").length, 1 + A.splitBolts);
    for (let i = 0; i < 240 && objects(fight, "bolt").length > 0; i++) {
      fight.step([IDLE]);
      novas.push(...fight.events.filter((e) => e.type === "spell" && e.form === "nova"));
    }
    assert.equal(novas.length, 1 + A.splitBolts);
    close(lostHp(fight, 0), MAGIC.bolt.splitShare * W * D + MAGIC.plain.damage * D);
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
