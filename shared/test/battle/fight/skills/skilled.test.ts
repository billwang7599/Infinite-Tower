import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Enemy, Health, PLAYER, releaseTime, SkillObject, Skilled, type Vec3 } from "@infinite-tower/shared";
import { chant, Fight, initPhysics, releaseChant, startCast } from "@infinite-tower/shared/fight";
import { ARENA, enemy, player, run, segment, skill, STATUE } from "../fixtures.js";

await initPhysics();

const at = (x: number, z: number): Vec3 => ({ x, y: 0.05, z });
const BOLT = skill(segment("bolt"));
/** A statue with skillpower: enemies' is 0, so their skills would do no damage. */
const CASTER = { ...STATUE, stats: { ...STATUE.stats, skillpower: 10 } };

function facingOff(): Fight {
  return new Fight({ arena: ARENA, players: [player(at(0, -4))], enemies: [enemy(CASTER, at(0, 4))] });
}
const caster = (fight: Fight) => fight.enemies[0]!;
const skilledOf = (fight: Fight) => fight.world.require(caster(fight), Skilled);
const boltsBy = (fight: Fight, e: number) => [...fight.world.query(SkillObject)].filter(([, o]) => o.caster === e);
const stun = (fight: Fight) => Object.assign(fight.world.require(caster(fight), Enemy), { state: "stunned", duration: 1 });
const playerHp = (fight: Fight) => fight.world.require(fight.players[0]!, Health).hp;

describe("an enemy that uses skills", () => {
  test("chants word by word, its words in the fight's state, then releases the chant", () => {
    const fight = facingOff();
    chant(fight.world, caster(fight), ["bolt"]);
    fight.step([]);
    chant(fight.world, caster(fight), ["bolt", "fire"]);
    fight.step([]);
    const saved = fight.save().enemies[0]!.skilled;
    assert.equal(saved.chanting, true);
    assert.deepEqual(saved.words, ["bolt", "fire"]);

    assert.ok(releaseChant(fight.world, caster(fight)));
    assert.equal(skilledOf(fight).chanting, false);
    assert.deepEqual(skilledOf(fight).words, []);
    run(fight, releaseTime(skill(segment("bolt", ["fire"]))));
    assert.equal(boltsBy(fight, caster(fight)).length, 1);
    run(fight, 1);
    assert.ok(playerHp(fight) < PLAYER.maxHp, "the Bolt hit the player");
  });

  test("quick-casts with one call", () => {
    const fight = facingOff();
    assert.ok(startCast(fight.world, caster(fight), BOLT));
    run(fight, releaseTime(BOLT));
    assert.equal(boltsBy(fight, caster(fight)).length, 1);
  });

  test("one cast at a time", () => {
    const fight = facingOff();
    assert.ok(startCast(fight.world, caster(fight), BOLT));
    assert.equal(startCast(fight.world, caster(fight), BOLT), false);
  });

  test("a stun breaks its chant off, words and all, as it does the player's", () => {
    const fight = facingOff();
    chant(fight.world, caster(fight), ["bolt", "fire"]);
    stun(fight);
    fight.step([]);
    assert.equal(skilledOf(fight).chanting, false);
    assert.deepEqual(skilledOf(fight).words, []);
  });

  test("a stun cancels its wind-up: nothing is released", () => {
    const fight = facingOff();
    startCast(fight.world, caster(fight), BOLT);
    stun(fight);
    run(fight, releaseTime(BOLT) + 0.1);
    assert.equal(boltsBy(fight, caster(fight)).length, 0);
  });

  test("saved mid-chant and loaded into another fight, it's the same fight", () => {
    const a = facingOff();
    chant(a.world, caster(a), ["bolt", "fire"]);
    a.step([]);
    const b = facingOff();
    b.load(JSON.parse(JSON.stringify(a.save())));
    assert.equal(b.hash(), a.hash());
    assert.deepEqual(skilledOf(b).words, ["bolt", "fire"]);
  });
});
