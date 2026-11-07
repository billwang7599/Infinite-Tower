import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  addItem, BOW, CHAIN, emptyBag, emptyEquipment, Enemy, FIXED_DT, Health, HYBRID, packFor, toSteps, wayStepsAfter,
  WEAPONS, windupTime, type EnemyDef, type ItemId, type Strike, type Vec3,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import {
  ARENA, armed, BOAR, bodyOf, castNow, enemy, flatDist, flatRadius, GUARDIAN, input, LURKER, player, run, segment,
  skill, STATS, STATUE,
} from "./fixtures.js";

before(() => initPhysics());

const at = (x: number, z: number): Vec3 => ({ x, y: 0.05, z });
const IN_REACH_M = 2.4;
const SLOWEST = wayStepsAfter(WEAPONS.greatsword, windupTime("heavy", "opening"), true, STATS.strength);
const SETTLE_TIME = SLOWEST.endAt * FIXED_DT + 1;

const PERSON: EnemyDef = { ...STATUE, knockbackFactor: 1 };
const heavier = (def: EnemyDef, factor: number): EnemyDef => ({ ...def, knockbackFactor: factor });

const holding = (rightHand: ItemId) =>
  ({ bag: emptyBag(), pack: packFor(null), quiver: packFor(null), equipment: { ...armed(), rightHand } });

function fightAt(def: EnemyDef, foe: Vec3, hand: ItemId = "sword", me: Vec3 = at(0, 0)): Fight {
  return new Fight({ arena: ARENA, players: [player(me, { gear: holding(hand) })], enemies: [enemy(def, foe)] });
}

function strikeOnce(fight: Fight, strike: Strike): FightEvent[] {
  const events: FightEvent[] = [];
  run(fight, SETTLE_TIME, (step) => {
    events.push(...fight.events);
    return input({ way: "lr", attack: step === 0 ? strike : null });
  });
  events.push(...fight.events);
  return events;
}

function pushed(strike: Strike, def: EnemyDef = PERSON, hand: ItemId = "sword"): number {
  const fight = fightAt(def, at(0, IN_REACH_M), hand);
  run(fight, 0.1);
  const from = { ...bodyOf(fight, fight.enemies[0]!).pos };
  const landed = strikeOnce(fight, strike).filter((e) => e.type === "hit" && e.target === fight.enemies[0]);
  assert.equal(landed.length, 1, `the ${strike} lands`);
  return flatDist(bodyOf(fight, fight.enemies[0]!).pos, from);
}

describe("a player's hit knocks an enemy back (the user: \"balance it\")", () => {
  test("a light pushes it back a little, away from the player; a stab further, a heavy furthest", () => {
    const fight = fightAt(PERSON, at(0, IN_REACH_M));
    run(fight, 0.1);
    strikeOnce(fight, "light");
    const now = bodyOf(fight, fight.enemies[0]!).pos;
    assert.ok(now.z > IN_REACH_M + 0.1 && Math.abs(now.x) < 0.05, `at ${JSON.stringify(now)}`);
    const light = pushed("light"), stab = pushed("stab"), heavy = pushed("heavy");
    assert.ok(light < stab && stab < heavy, `light ${light}, stab ${stab}, heavy ${heavy}`);
    const lightStepM = HYBRID.swinging.lungeSpeed * CHAIN.activeTime;
    assert.ok(light < lightStepM, `a light's ${light} m, less than its own step in (${lightStepM} m): lights chain on`);
  });

  test("by the strike alone: a greatsword's heavy, out of a longer reach, pushes no further than a sword's", () => {
    assert.ok(Math.abs(pushed("heavy", PERSON, "greatsword") - pushed("heavy", PERSON, "sword")) < 0.02);
  });

  test("a heavier enemy is pushed less, by its knockbackFactor; one with none doesn't budge", () => {
    assert.ok(pushed("heavy", heavier(PERSON, 0.5)) < pushed("heavy", PERSON) / 2);
    assert.equal(pushed("heavy", heavier(PERSON, 0)), 0);
  });

  test("never through the wall: a heavy at an enemy against it leaves it inside", () => {
    const wallZ = ARENA.radius - PERSON.radius - 0.1;
    const fight = fightAt(PERSON, at(0, wallZ), "sword", at(0, wallZ - IN_REACH_M));
    assert.ok(pushed("heavy") > 0.5, "far enough to reach the wall");
    run(fight, 0.1);
    const hits = strikeOnce(fight, "heavy").filter((e) => e.type === "hit" && e.target === fight.enemies[0]);
    assert.equal(hits.length, 1);
    const r = flatRadius(bodyOf(fight, fight.enemies[0]!).pos);
    assert.ok(r <= ARENA.radius - PERSON.radius + 0.01, `${r} m from the middle`);
  });

  test("no juggling: a heavy never lifts it, and it isn't stunned, only moved", () => {
    const fight = fightAt(PERSON, at(0, IN_REACH_M));
    run(fight, 0.1);
    const groundY = bodyOf(fight, fight.enemies[0]!).pos.y;
    let highest = groundY;
    const states = new Set<string>();
    run(fight, SETTLE_TIME, (step) => {
      highest = Math.max(highest, bodyOf(fight, fight.enemies[0]!).pos.y);
      states.add(fight.world.require(fight.enemies[0]!, Enemy).state);
      return input({ way: "lr", attack: step === 0 ? "heavy" : null });
    });
    assert.ok(highest < groundY + 1e-3, `rose to ${highest}`);
    assert.deepEqual([...states], ["approach"]);
  });

  test("no stun-lock: a boar under a stream of lights is pushed about, and still bites, again and again", () => {
    const boar: EnemyDef = { ...BOAR, knockbackFactor: 1, poise: 10_000, attacks: { lunge: BOAR.attacks.lunge! } };
    const fight = fightAt(boar, at(0, IN_REACH_M));
    const me = fight.players[0]!, it = fight.enemies[0]!;
    let bites = 0, knockedAway = false;
    run(fight, 6, (step) => {
      bites += fight.events.filter((e) => e.type === "hit" && e.target === me).length;
      const a = bodyOf(fight, me).pos, b = bodyOf(fight, it).pos, d = flatDist(a, b);
      const aimX = (b.x - a.x) / d, aimZ = (b.z - a.z) / d, v = bodyOf(fight, it).vel;
      if (v.x * aimX + v.z * aimZ > 1) knockedAway = true;
      const toward = d > IN_REACH_M ? 1 : 0;
      return input({
        aimX, aimZ, moveX: aimX * toward, moveZ: aimZ * toward, locked: 0, way: step % 40 < 20 ? "lr" : "rl",
        attack: step % 2 === 0 ? "light" : null,
      });
    });
    assert.ok(knockedAway, "the lights pushed it back");
    assert.ok(bites >= 2, `${bites} bites in 6 s`);
  });

  test("a committed blow isn't knocked off its line: a lurker rising to slam doesn't budge", () => {
    const lurker = heavier(LURKER, 1);
    const fight = fightAt(lurker, at(0, 2.5));
    const it = fight.enemies[0]!, state = () => fight.world.require(it, Enemy).state;
    while (state() !== "slamWindup") fight.step([input({})]);
    const from = { ...bodyOf(fight, it).pos };
    let struck = false;
    for (let i = 0; state() === "slamWindup"; i++) {
      fight.step([input({ way: "lr", attack: i === 0 ? "heavy" : null })]);
      struck ||= fight.events.some((e) => e.type === "hit" && e.target === it);
    }
    assert.ok(struck, "the heavy landed in its wind-up");
    assert.ok(flatDist(bodyOf(fight, it).pos, from) < 1e-6);
  });

  test("a blocked hit still shoves the blocker back, at the block's pushback share", () => {
    const guard = heavier(GUARDIAN, 1);
    const fight = fightAt(guard, at(0, IN_REACH_M));
    run(fight, 0.5);
    const from = { ...bodyOf(fight, fight.enemies[0]!).pos };
    const events = strikeOnce(fight, "heavy");
    assert.ok(events.some((e) => e.type === "block" && e.target === fight.enemies[0]), "blocked");
    const moved = flatDist(bodyOf(fight, fight.enemies[0]!).pos, from);
    // Slid from rest, the distance goes as the speed squared.
    const expected = pushed("heavy") * HYBRID.block.pushbackFactor ** 2;
    assert.ok(Math.abs(moved - expected) < 0.05, `${moved} m blocked, ${expected} m expected`);
  });

  test("an enemy blocking backed against the wall lets twice the chip through", () => {
    const chipped = (roomM: number) => {
      const z = ARENA.radius - GUARDIAN.radius - roomM;
      const fight = fightAt(heavier(GUARDIAN, 1), at(0, z), "sword", at(0, z - IN_REACH_M));
      run(fight, 0.5);
      const events = strikeOnce(fight, "heavy");
      assert.ok(events.some((e) => e.type === "block" && e.target === fight.enemies[0]), `blocked, ${roomM} m behind`);
      return GUARDIAN.maxHp - fight.world.require(fight.enemies[0]!, Health).hp;
    };
    const open = chipped(3);
    assert.ok(open > 0);
    assert.ok(Math.abs(chipped(0) - open * HYBRID.block.pinnedChipFactor) < 1e-6, `${chipped(0)} vs ${open}`);
  });

  test("an arrow pushes by how hard it flies: a full draw further than a quick loose", () => {
    const shot = (heldSteps: number): number => {
      const fight = new Fight({
        arena: { ...ARENA, radius: 40 },
        players: [player(at(0, 0), {
          gear: {
            bag: addItem(emptyBag(), BOW.ammo, 5).bag, pack: packFor(null), quiver: packFor(null),
            equipment: { ...emptyEquipment(), rightHand: "training-bow" },
          },
        })],
        enemies: [enemy({ ...PERSON, maxHp: 10_000 }, at(0, 4))],
      });
      const from = { ...bodyOf(fight, fight.enemies[0]!).pos };
      let hits = 0;
      run(fight, 3, (step) => {
        hits += fight.events.filter((e) => e.type === "hit").length;
        return input({ locked: 0, attack: step === 0 ? "light" : null, attackHeld: step < heldSteps });
      });
      assert.equal(hits, 1);
      return flatDist(bodyOf(fight, fight.enemies[0]!).pos, from);
    };
    const quick = shot(1), full = shot(toSteps(BOW.draw.fullTime) + 5);
    assert.ok(quick > 0 && full > quick * 5, `quick ${quick} m, full ${full} m`);
  });

  test("Air pushes a heavier enemy less too", () => {
    const blown = (def: EnemyDef) => {
      const fight = fightAt(def, at(0, 2));
      castNow(fight, skill(segment("nova", ["air"])));
      const from = { ...bodyOf(fight, fight.enemies[0]!).pos };
      run(fight, SETTLE_TIME);
      return flatDist(bodyOf(fight, fight.enemies[0]!).pos, from);
    };
    assert.ok(blown(heavier(PERSON, 0.5)) < blown(PERSON) / 2);
  });

  test("a player hit by a player's sword in a duel is still only hurt, not pushed", () => {
    const fight = new Fight({ arena: ARENA, duel: true, players: [player(at(0, 0)), player(at(0, 2))], enemies: [] });
    const them = fight.players[1]!, from = { ...bodyOf(fight, them).pos };
    let hit = false;
    for (let i = 0; i < SETTLE_TIME / FIXED_DT; i++) {
      fight.step([input({ way: "lr", attack: i === 0 ? "heavy" : null }), input({ aimZ: -1 })]);
      hit ||= fight.events.some((e) => e.type === "hit" && e.target === them);
    }
    assert.ok(hit);
    assert.ok(flatDist(bodyOf(fight, them).pos, from) < 1e-6);
  });
});
