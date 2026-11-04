import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  emptyBag, FIXED_DT, Health, ITEMS, packFor, Player, type Bag, type Carried, type EnemyDef, type UseSpot, type Vec3,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import {
  ARENA, BITER, bodyOf, enemy, FULL_HP, FULL_STAMINA, IDLE, input, player, run, STATUE, SWORDSMAN, armed,
} from "../fixtures.js";

await initPhysics();

const { useTime: USE_TIME, effects: [{ healShare: HEAL_SHARE }] } = ITEMS["boar-meat"].consumable;
const HEAL_HP = HEAL_SHARE * FULL_HP;
const HURT_HP = 50;
const MEAT_AT: UseSpot = { in: "bag", x: 0, y: 0 };
const BAG = input({ bag: true });
const EAT = input({ bag: true, use: MEAT_AT });
const at = (x: number, z: number): Vec3 => ({ x, y: 0.05, z });
const withMeat = (count = 2): Carried => ({
  bag: { ...emptyBag(), items: [{ item: "boar-meat", count, x: 0, y: 0, turned: false }] }, pack: packFor(null),
  equipment: armed(),
});

function hungry(foe: EnemyDef = STATUE, foeAt = at(0, 6), hp = HURT_HP): Fight {
  return new Fight({
    arena: ARENA, players: [player(at(0, 0), { gear: withMeat(), vitals: { hp, stamina: FULL_STAMINA } })],
    enemies: [enemy(foe, foeAt)],
  });
}
const me = (fight: Fight) => fight.world.require(fight.players[0]!, Player);
const hpOf = (fight: Fight) => fight.world.require(fight.players[0]!, Health).hp;
const meatLeft = (fight: Fight) => me(fight).gear.bag.items.find((s) => s.item === "boar-meat")?.count ?? 0;

function startEating(fight: Fight): void {
  run(fight, 0.1);
  fight.step([BAG]);
  fight.step([EAT]);
}

describe("eating in a fight", () => {
  test("meat in the backpack is eaten from there, as from the bag", () => {
    const meat = { item: "boar-meat", count: 2, x: 3, y: 3, turned: false } as const;
    const pack: Bag = { ...packFor("canvas-backpack"), items: [meat] };
    const fight = new Fight({
      arena: ARENA, enemies: [enemy(STATUE, at(0, 6))],
      players: [player(at(0, 0), {
        gear: { bag: emptyBag(), pack, equipment: { ...armed(), back: "canvas-backpack" } },
        vitals: { hp: HURT_HP, stamina: FULL_STAMINA },
      })],
    });
    run(fight, 0.1);
    fight.step([BAG]);
    fight.step([input({ bag: true, use: { in: "pack", x: 3, y: 3 } })]);
    run(fight, USE_TIME, () => BAG);
    assert.equal(hpOf(fight), HURT_HP + HEAL_HP);
    assert.deepEqual(me(fight).gear.pack.items, [{ item: "boar-meat", count: 1, x: 3, y: 3, turned: false }]);
  });

  test("meat eaten from the bag heals once its useTime is up, uses one up, and the bag stays open", () => {
    const fight = hungry();
    startEating(fight);
    assert.equal(me(fight).action, "use");
    run(fight, USE_TIME - 2 * FIXED_DT, () => BAG);
    assert.equal(hpOf(fight), HURT_HP, "not yet");
    assert.equal(meatLeft(fight), 2);
    run(fight, 2 * FIXED_DT, () => BAG);
    assert.equal(hpOf(fight), HURT_HP + HEAL_HP);
    assert.equal(meatLeft(fight), 1);
    assert.equal(me(fight).action, "bag");
  });

  test("it says so, once, as it's eaten", () => {
    const fight = hungry();
    startEating(fight);
    const events: FightEvent[] = [];
    for (let i = 0; i < USE_TIME / FIXED_DT + 5; i++) {
      fight.step([BAG]);
      events.push(...fight.events);
    }
    const used = events.filter((e) => e.type === "used");
    assert.deepEqual(used, [{ type: "used", player: fight.players[0]!, item: "boar-meat", brokeThrough: false }]);
  });

  test("the player stands still while eating", () => {
    const fight = hungry();
    startEating(fight);
    const before = { ...bodyOf(fight, fight.players[0]!).pos };
    run(fight, USE_TIME / 2, () => input({ bag: true, moveX: 1 }));
    const after = bodyOf(fight, fight.players[0]!).pos;
    assert.ok(Math.hypot(after.x - before.x, after.z - before.z) < 0.01);
  });

  test("not at full HP, and not what doesn't heal", () => {
    const full = hungry(STATUE, at(0, 6), FULL_HP);
    startEating(full);
    assert.equal(me(full).action, "bag");
    const fight = hungry();
    run(fight, 0.1);
    fight.step([BAG]);
    fight.step([input({ bag: true, use: { in: "bag", x: 3, y: 3 } })]);
    assert.equal(me(fight).action, "bag");
  });

  test("not with the bag shut", () => {
    const fight = hungry();
    run(fight, 0.1);
    fight.step([input({ use: MEAT_AT })]);
    run(fight, USE_TIME + 0.1);
    assert.equal(hpOf(fight), HURT_HP);
    assert.equal(meatLeft(fight), 2);
  });

  test("closing the bag stops it: nothing healed, the meat kept", () => {
    const fight = hungry();
    startEating(fight);
    run(fight, USE_TIME / 2, () => BAG);
    fight.step([IDLE]);
    assert.equal(me(fight).action, "none");
    run(fight, USE_TIME, () => BAG);
    assert.equal(hpOf(fight), HURT_HP);
    assert.equal(meatLeft(fight), 2);
  });

  test("a dodge stops it, and dodges", () => {
    const fight = hungry();
    startEating(fight);
    fight.step([input({ bag: true, dodge: true, moveX: 1 })]);
    assert.equal(me(fight).action, "dodge");
    run(fight, USE_TIME, () => BAG);
    assert.equal(meatLeft(fight), 2);
  });

  test("a hit that only hurts stops it, the meat kept, the bag still open", () => {
    const fight = hungry(SWORDSMAN, at(0, 2));
    startEating(fight);
    for (let i = 0; i < USE_TIME / FIXED_DT && hpOf(fight) === HURT_HP; i++) fight.step([BAG]);
    const cut = hpOf(fight);
    assert.ok(cut < HURT_HP, "hit by the sword");
    assert.equal(fight.world.require(fight.players[0]!, Health).hitstun, 0, "only hurt");
    assert.equal(me(fight).action, "bag");
    run(fight, USE_TIME, () => BAG);
    assert.equal(meatLeft(fight), 2);
    assert.ok(hpOf(fight) <= cut, "nothing healed");
  });

  test("a hit that stuns stops it and closes the bag, the meat kept", () => {
    const fight = hungry(BITER, at(0, 1.5));
    startEating(fight);
    for (let i = 0; i < USE_TIME / FIXED_DT && hpOf(fight) === HURT_HP; i++) fight.step([BAG]);
    assert.ok(hpOf(fight) < HURT_HP, "bitten");
    assert.equal(me(fight).brokenOff, true);
    run(fight, USE_TIME, () => BAG);
    assert.equal(meatLeft(fight), 2);
  });

  test("nothing in the bag moves while eating", () => {
    const fight = hungry();
    startEating(fight);
    const move = { from: { in: "bag", x: 0, y: 0 }, to: { in: "bag", x: 3, y: 2 }, turned: false } as const;
    fight.step([input({ bag: true, gear: move })]);
    assert.deepEqual(me(fight).gear.bag, withMeat().bag);
  });

  test("through a save and a load it's eaten on the same step", () => {
    const fight = hungry();
    startEating(fight);
    run(fight, USE_TIME / 2, () => BAG);
    const copy = hungry();
    copy.load(JSON.parse(JSON.stringify(fight.save())));
    assert.equal(copy.hash(), fight.hash());
    run(fight, USE_TIME / 2, () => BAG);
    run(copy, USE_TIME / 2, () => BAG);
    assert.equal(hpOf(copy), HURT_HP + HEAL_HP);
    assert.equal(copy.hash(), fight.hash());
  });
});
