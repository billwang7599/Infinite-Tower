import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  absorb, CORE_STEPS, coreStats, emptyBag, fillToFinish, FIXED_DT, FighterStats, Health, ITEMS, maxHpOf, newCore,
  Player, Stamina, staminaMaxOf, STAT_KEYS, type Carried, type CoreState, type EnemyDef,
  type UseSpot, type Vec3,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ARENA, bodyOf, enemy, input, player, run, STATS, STATUE, SWORDSMAN, armed } from "../fixtures.js";

await initPhysics();

const { useTime: USE_TIME, effects: [{ essence: WORTH }] } = ITEMS["boar-essence"].consumable;
const HURT_HP = 50, TIRED = 30;
const AT: UseSpot = { in: "bag", x: 0, y: 0 };
const BAG = input({ bag: true });
const ABSORB = input({ bag: true, use: AT });
const at = (x: number, z: number): Vec3 => ({ x, y: 0.05, z });
const withEssence = (count = 2): Carried => ({
  bag: { ...emptyBag(), items: [{ item: "boar-essence", count, x: 0, y: 0, turned: false }] },
  equipment: armed(),
});

function holding(
  core: CoreState = newCore(), foe: EnemyDef = STATUE, foeAt = at(0, 6), stats = { ...coreStats(core), healthRegen: 0 },
): Fight {
  return new Fight({
    arena: ARENA, enemies: [enemy(foe, foeAt)],
    players: [player(at(0, 0), { gear: withEssence(), core, stats, vitals: { hp: HURT_HP, stamina: TIRED } })],
  });
}
const me = (fight: Fight) => fight.world.require(fight.players[0]!, Player);
const left = (fight: Fight) => me(fight).gear.bag.items.find((s) => s.item === "boar-essence")?.count ?? 0;

function startAbsorbing(fight: Fight): void {
  run(fight, 0.1);
  fight.step([BAG]);
  fight.step([ABSORB]);
}

const nearlyThrough = (): CoreState => ({ ...newCore(), fill: fillToFinish(1) - WORTH });

describe("absorbing essence in a fight", () => {
  test("it goes into the core once its useTime is up, using one up", () => {
    const fight = holding();
    startAbsorbing(fight);
    assert.equal(me(fight).action, "use");
    run(fight, USE_TIME - 2 * FIXED_DT, () => BAG);
    assert.deepEqual(me(fight).core, newCore(), "not yet");
    run(fight, 2 * FIXED_DT, () => BAG);
    assert.deepEqual(me(fight).core, absorb(newCore(), WORTH));
    assert.equal(left(fight), 1);
  });

  test("the player stands still while absorbing", () => {
    const fight = holding();
    startAbsorbing(fight);
    const before = { ...bodyOf(fight, fight.players[0]!).pos };
    run(fight, USE_TIME / 2, () => input({ bag: true, moveX: 1 }));
    const after = bodyOf(fight, fight.players[0]!).pos;
    assert.ok(Math.hypot(after.x - before.x, after.z - before.z) < 0.01);
  });

  test("a hit stops it, and the essence stays in the bag", () => {
    const fight = holding(newCore(), SWORDSMAN, at(0, 2));
    startAbsorbing(fight);
    const hp = () => fight.world.require(fight.players[0]!, Health).hp;
    for (let i = 0; i < USE_TIME / FIXED_DT && hp() === HURT_HP; i++) fight.step([BAG]);
    assert.ok(hp() < HURT_HP, "hit by the sword");
    run(fight, USE_TIME, () => BAG);
    assert.equal(left(fight), 2);
    assert.deepEqual(me(fight).core, newCore());
  });

  test("a breakthrough grows the stats at once, the bars and what's in them by as much", () => {
    const fight = holding(nearlyThrough(), STATUE, at(0, 6), coreStats(nearlyThrough()));
    const e = fight.players[0]!;
    startAbsorbing(fight);
    const events: FightEvent[] = [];
    for (let i = 0; i < USE_TIME / FIXED_DT + 2; i++) {
      fight.step([BAG]);
      events.push(...fight.events);
    }
    assert.equal(me(fight).core.steps, 1);
    const grown = coreStats(me(fight).core), stats = fight.world.require(e, FighterStats);
    for (const stat of STAT_KEYS) assert.equal(stats[stat], grown[stat], stat);
    const health = fight.world.require(e, Health), stamina = fight.world.require(e, Stamina);
    assert.equal(health.max, maxHpOf(grown));
    const hpGrown = HURT_HP + maxHpOf(grown) - maxHpOf(STATS);
    assert.ok(health.hp >= hpGrown && health.hp < hpGrown + 2, "grown, and a little regen");
    assert.equal(stamina.max, staminaMaxOf(grown));
    assert.ok(stamina.value >= TIRED + staminaMaxOf(grown) - staminaMaxOf(STATS));
    const used = events.filter((event) => event.type === "used");
    assert.deepEqual(used, [{ type: "used", player: e, item: "boar-essence", brokeThrough: true }]);
  });

  test("not into a core that's whole", () => {
    const fight = holding({ ...newCore(), steps: CORE_STEPS });
    startAbsorbing(fight);
    assert.equal(me(fight).action, "bag");
  });

  test("through a save and a load, the grown stats and bars are the fight's", () => {
    const fight = holding(nearlyThrough());
    startAbsorbing(fight);
    run(fight, USE_TIME + 0.1, () => BAG);
    const copy = holding(nearlyThrough());
    copy.load(JSON.parse(JSON.stringify(fight.save())));
    assert.equal(copy.hash(), fight.hash());
    const e = copy.players[0]!;
    assert.equal(copy.world.require(e, Health).max, fight.world.require(fight.players[0]!, Health).max);
    assert.equal(copy.world.require(e, Stamina).max, fight.world.require(fight.players[0]!, Stamina).max);
    assert.deepEqual(copy.world.require(e, FighterStats), fight.world.require(fight.players[0]!, FighterStats));
  });
});
