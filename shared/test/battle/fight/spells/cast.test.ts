import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  castTime, dodgeCost, FIXED_DT, Health, MAGIC, Player, SpellObject, Stamina, spellCost, Statuses, type EnemyDef,
  type Spell, type Vec3,
} from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import {
  ARENA, BITER, castNow, dumpState, enemy, IDLE, input, player, run, segment, spell, STATUE, SWORDSMAN,
} from "../fixtures.js";

await initPhysics();

const D = MAGIC.damage;
const ME: Vec3 = { x: 0, y: 0.05, z: -4 };
const at = (x: number, z: number): Vec3 => ({ x, y: 0.05, z });

const BOLT_FIRE = spell(segment("bolt", ["fire"]));
const onPage = (written: Spell) => ({ book: [written, null, null, null] });

function fightWith(enemies: Vec3[], def: EnemyDef = STATUE): Fight {
  const players = [player(ME, onPage(BOLT_FIRE))];
  return new Fight({ arena: ARENA, players, enemies: enemies.map((e) => enemy(def, e)) });
}
const hpOf = (fight: Fight, i: number) => fight.world.require(fight.enemies[i]!, Health).hp;
const lostHp = (fight: Fight, i: number) => fight.world.require(fight.enemies[i]!, Health).max - hpOf(fight, i);
const me = (fight: Fight) => fight.players[0]!;
const shots = (fight: Fight) => [...fight.world.query(SpellObject)];

function untilLanded(fight: Fight): void {
  for (let i = 0; i < 120 && shots(fight).length > 0; i++) fight.step([IDLE]);
}

describe("casting", () => {
  test("the wind-up lasts the spell's cast time; its stamina is paid as it's released", () => {
    const fight = fightWith([at(0, 4)]);
    const stamina = fight.world.require(me(fight), Stamina);
    const before = stamina.value;
    fight.step([input({ cast: BOLT_FIRE })]);
    assert.equal(fight.world.require(me(fight), Player).action, "cast");
    run(fight, castTime(BOLT_FIRE) - 2 * FIXED_DT);
    assert.equal(stamina.value, before, "nothing paid during the wind-up");
    assert.equal(shots(fight).length, 0);
    run(fight, 2 * FIXED_DT);
    assert.equal(stamina.value, before - spellCost(BOLT_FIRE));
    assert.equal(shots(fight).length, 1);
    assert.equal(fight.world.require(me(fight), Player).action, "none");
  });

  test("a Bolt flies where the player aims and hits the first enemy on its line", () => {
    const fight = fightWith([at(0, 4), at(0, 7)]);
    castNow(fight, BOLT_FIRE);
    untilLanded(fight);
    assert.equal(lostHp(fight, 0), MAGIC.elements.fire.damage * D);
    assert.equal(lostHp(fight, 1), 0);
  });

  test("aimed away, a Bolt misses", () => {
    const fight = fightWith([at(0, 4)]);
    castNow(fight, BOLT_FIRE, { aimX: 1, aimZ: 0 });
    untilLanded(fight);
    assert.equal(lostHp(fight, 0), 0);
  });

  test("short of the stamina, the cast doesn't start", () => {
    const fight = fightWith([at(0, 4)]);
    fight.world.require(me(fight), Stamina).value = spellCost(BOLT_FIRE) - 1;
    fight.step([input({ cast: BOLT_FIRE })]);
    assert.equal(fight.world.require(me(fight), Player).action, "none");
  });

  test("a dodge during the wind-up cancels it at no cost", () => {
    const fight = fightWith([at(0, 4)]);
    const stamina = fight.world.require(me(fight), Stamina);
    fight.step([input({ cast: BOLT_FIRE })]);
    run(fight, 0.1);
    const before = stamina.value;
    fight.step([input({ moveX: 1, dodge: true })]);
    assert.equal(fight.world.require(me(fight), Player).action, "dodge");
    run(fight, castTime(BOLT_FIRE));
    assert.equal(shots(fight).length, 0);
    assert.equal(stamina.value, before - dodgeCost("light")!, "only the dodge's cost");
    assert.equal(lostHp(fight, 0), 0);
  });

  test("a cast pressed mid-swing waits for the swing to let go, then winds up", () => {
    const fight = fightWith([at(0, 6)]);
    fight.step([input({ attack: "lr" })]);
    fight.step([input({ cast: BOLT_FIRE })]);
    const player = fight.world.require(me(fight), Player);
    assert.equal(player.action, "attack");
    let steps = 0;
    while (player.action === "attack" && steps++ < 120) fight.step([IDLE]);
    assert.equal(player.action, "cast");
  });

  test("a hit that stuns during the wind-up interrupts it at no cost", () => {
    const slow = spell(segment("bolt", ["fire", "earth", "lightning"]));
    const fight = new Fight({
      arena: ARENA, players: [player(at(0, -1), onPage(slow))], enemies: [enemy(BITER, at(0, 1.5))],
    });
    const stamina = fight.world.require(me(fight), Stamina);
    const before = stamina.value;
    fight.step([input({ cast: slow })]);
    run(fight, castTime(slow) + 0.2);
    assert.ok(fight.world.require(me(fight), Health).hp < 100, "bitten");
    assert.equal(stamina.value, before);
    assert.equal(shots(fight).length, 0);
  });

  test("a sword hit during the wind-up only hurts: the cast still goes off", () => {
    const slow = spell(segment("bolt", ["fire", "earth", "lightning"]), segment("bolt", ["water", "air"]));
    const fight = new Fight({
      arena: ARENA, players: [player(at(0, -1), onPage(slow))], enemies: [enemy(SWORDSMAN, at(0, 1))],
    });
    const stamina = fight.world.require(me(fight), Stamina);
    const before = stamina.value;
    fight.step([input({ cast: slow })]);
    run(fight, castTime(slow));
    assert.ok(fight.world.require(me(fight), Health).hp < 100, "cut");
    assert.equal(stamina.value, before - spellCost(slow));
    untilLanded(fight);
    assert.ok(lostHp(fight, 0) > 0);
  });

  test("your own spells never hurt you", () => {
    const fight = fightWith([at(0, -2)]);
    castNow(fight, spell(segment("nova", ["fire", "lightning"])));
    run(fight, 1);
    assert.equal(fight.world.require(me(fight), Health).hp, 100);
    assert.equal(fight.world.require(me(fight), Statuses).left.burning, 0);
    assert.ok(lostHp(fight, 0) > 0);
  });
});

describe("Forms", () => {
  test("a Nova hits every enemy within its radius of the caster, and none beyond", () => {
    const reach = MAGIC.nova.radius + STATUE.radius;
    const fight = fightWith([at(0, -4 + reach - 0.1), at(-(reach + 0.2), -4)]);
    castNow(fight, spell(segment("nova", ["water"])));
    assert.equal(lostHp(fight, 0), MAGIC.elements.water.damage * D);
    assert.equal(lostHp(fight, 1), 0);
  });

  test("Self puts the element's own effect on the caster", () => {
    const fight = fightWith([at(0, 4)]);
    castNow(fight, spell(segment("self", ["fire", "air"])));
    const statuses = fight.world.require(me(fight), Statuses);
    assert.ok(statuses.left.empowered > 0);
    assert.ok(statuses.left.hasted > 0);
    assert.equal(lostHp(fight, 0), 0);
  });
});

describe("chains", () => {
  test("the next segment fires where a Bolt hits", () => {
    // A Nova there reaches the enemy behind the one hit, out of the first Bolt's line.
    const fight = fightWith([at(0, 2), at(2, 3)]);
    castNow(fight, spell(segment("bolt", ["fire"]), segment("nova", ["water"])));
    untilLanded(fight);
    assert.ok(lostHp(fight, 1) > 0);
  });

  test("a Bolt that misses hands off at its full range", () => {
    const fight = new Fight({
      arena: { radius: 40 }, players: [player(at(0, 0))], enemies: [enemy(STATUE, at(0, MAGIC.bolt.rangeM + 2))],
    });
    castNow(fight, spell(segment("bolt", ["fire"]), segment("nova", ["water"])));
    untilLanded(fight);
    assert.equal(lostHp(fight, 0), MAGIC.elements.water.damage * D);
  });

  test("a Bolt that reaches the arena's wall hands off there", () => {
    const fight = fightWith([at(4, 5)]);
    castNow(fight, spell(segment("bolt", ["fire"]), segment("nova", ["water"])), { aimX: 0.6, aimZ: 0.8 });
    untilLanded(fight);
    assert.equal(lostHp(fight, 0), MAGIC.elements.water.damage * D);
  });

  test("a later Bolt keeps the direction of the Bolt before it, skipping the enemy that one hit", () => {
    const fight = fightWith([at(0, 0), at(0, 4)]);
    castNow(fight, spell(segment("bolt", ["earth"]), segment("bolt", ["water"])));
    untilLanded(fight);
    assert.equal(lostHp(fight, 0), MAGIC.elements.earth.damage * D);
    assert.equal(lostHp(fight, 1), MAGIC.elements.water.damage * D);
  });

  test("a Bolt after a Nova starts from the Nova's origin, toward the caster's aim", () => {
    const fight = fightWith([at(0, 4)]);
    castNow(fight, spell(segment("nova", ["water"]), segment("bolt", ["fire"])));
    untilLanded(fight);
    assert.equal(lostHp(fight, 0), MAGIC.elements.fire.damage * D);
  });
});

describe("a Bolt in the fight's state", () => {
  test("saved mid-flight and loaded into another fight, it flies on the same", () => {
    const a = fightWith([at(0, 6)]);
    castNow(a, BOLT_FIRE);
    a.step([IDLE]);
    assert.equal(shots(a).length, 1);
    const b = fightWith([at(0, 6)]);
    b.load(JSON.parse(JSON.stringify(a.save())));
    assert.equal(b.hash(), a.hash());
    for (let i = 0; i < 60; i++) { a.step([IDLE]); b.step([IDLE]); }
    assert.equal(dumpState(b).replace(/"e":\d+/g, ""), dumpState(a).replace(/"e":\d+/g, ""));
    assert.ok(lostHp(b, 0) > 0);
  });

  test("a Bolt in flight counts in the hash", () => {
    const a = fightWith([at(0, 6)]);
    castNow(a, BOLT_FIRE);
    const b = fightWith([at(0, 6)]);
    b.load({ ...a.save(), spells: [] });
    assert.notEqual(b.hash(), a.hash());
  });
});
