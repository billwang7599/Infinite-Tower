import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  addItem, BOW, emptyBag, emptyEquipment, Enemy, FIXED_DT, Health, HYBRID, packFor, Player, PLAYER, toSteps,
  wayStepsAfter, WEAPONS, Wielder, windupTime, type EnemyDef, type ItemId, type PlayerInputData, type Strike,
  type Vec3,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import {
  ARENA, armed, BOAR, bodyOf, castNow, enemy, flatDist, GUARDIAN, input, player, run, segment, skill,
  STATUE, STILL_BITER, SWORDSMAN, swings,
} from "./fixtures.js";

before(() => initPhysics());

const at = (x: number, z: number): Vec3 => ({ x, y: 0.05, z });
const IN_REACH_M = 2.4;
const SLOWEST = wayStepsAfter(WEAPONS.greatsword, windupTime("heavy", "opening"), true);
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

function moved(fight: Fight, strike: Strike): number {
  run(fight, 0.1);
  const from = { ...bodyOf(fight, fight.enemies[0]!).pos };
  const events = strikeOnce(fight, strike);
  assert.ok(events.some((e) => (e.type === "hit" || e.type === "block") && e.target === fight.enemies[0]), strike);
  return flatDist(bodyOf(fight, fight.enemies[0]!).pos, from);
}

describe("a hit that lands does damage only (the user: \"Hits do damage only\")", () => {
  test("a light, a stab or a heavy hurts an enemy without moving or stunning it", () => {
    for (const strike of ["light", "stab", "heavy"] as const) {
      const fight = fightAt(PERSON, at(0, IN_REACH_M));
      const states = new Set<string>();
      run(fight, 0.1);
      const from = { ...bodyOf(fight, fight.enemies[0]!).pos };
      run(fight, SETTLE_TIME, (step) => {
        states.add(fight.world.require(fight.enemies[0]!, Enemy).state);
        return input({ way: "lr", attack: step === 0 ? strike : null });
      });
      assert.ok(fight.world.require(fight.enemies[0]!, Health).hp < PERSON.maxHp, `the ${strike} lands`);
      assert.ok(flatDist(bodyOf(fight, fight.enemies[0]!).pos, from) < 1e-6, `the ${strike} doesn't move it`);
      assert.deepEqual([...states], ["approach"], strike);
    }
  });

  test("an enemy staggers only when its poise breaks, never from one hit", () => {
    const poise = HYBRID.heavy.poiseDamage + 1;
    const fight = fightAt({ ...PERSON, poise, poiseRegen: 0 }, at(0, IN_REACH_M));
    const statesThrough = (strike: Strike) => {
      const states = new Set<string>();
      run(fight, SETTLE_TIME, (step) => {
        states.add(fight.world.require(fight.enemies[0]!, Enemy).state);
        return input({ way: "lr", attack: step === 0 ? strike : null });
      });
      return [...states];
    };
    assert.deepEqual(statesThrough("heavy"), ["approach"], "one heavy leaves it standing");
    assert.ok(statesThrough("light").includes("staggered"), "the next breaks its poise");
  });

  test("an arrow hurts without pushing, however hard it flies", () => {
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
      const attackHeld = step < toSteps(BOW.draw.fullTime) + 5;
      return input({ locked: 0, attack: step === 0 ? "light" : null, attackHeld });
    });
    assert.equal(hits, 1);
    assert.ok(flatDist(bodyOf(fight, fight.enemies[0]!).pos, from) < 1e-6);
  });

  test("a body blow only hurts a player: no knockback, no lift, no stun, then the hurt invulnerability", () => {
    const fight = fightAt(STILL_BITER, at(0, 2.3));
    const me = fight.players[0]!, health = fight.world.require(me, Health);
    for (let i = 0; i < 120 && health.hp === health.max; i++) fight.step([input({})]);
    assert.ok(health.hp < health.max, "bitten");
    const vel = bodyOf(fight, me).vel;
    assert.ok(Math.hypot(vel.x, vel.z) < 1e-6 && Math.abs(vel.y) < 1e-3, `moving at ${JSON.stringify(vel)}`);
    assert.equal(health.hitstun, 0);
    assert.equal(health.invuln, PLAYER.hurtInvuln);
    fight.step([input({ attack: "light" })]);
    assert.equal(fight.world.require(me, Player).action, "attack", "acts on the very next step");
  });

  test("getting hit breaks your momentum chain", () => {
    const late: EnemyDef = { ...STILL_BITER, attacks: { lunge: { ...STILL_BITER.attacks.lunge!, firstDelay: 2 } } };
    const fight = fightAt(late, at(0, 2.3));
    const me = fight.players[0]!, health = fight.world.require(me, Health), wielder = fight.world.require(me, Wielder);
    let before = 0;
    for (let i = 0; i < 300 && health.hp === health.max; i++) {
      before = wielder.chains.rightHand.momentum;
      fight.step([input({ way: i % 40 < 20 ? "lr" : "rl", attack: i % 2 === 0 ? "light" : null })]);
    }
    assert.ok(health.hp < health.max, "bitten");
    assert.ok(before > 0, "bitten mid-chain");
    assert.deepEqual(Object.values(wielder.chains).map((c) => [c.momentum, c.combo]), [[0, null], [0, null]]);
  });

  test("no stun-lock: a boar under a stream of lights still bites, again and again", () => {
    const boar: EnemyDef = {
      ...BOAR, maxHp: 10_000, knockbackFactor: 1, poise: 10_000, attacks: { lunge: BOAR.attacks.lunge! },
    };
    const fight = fightAt(boar, at(0, IN_REACH_M));
    const me = fight.players[0]!, it = fight.enemies[0]!;
    let bites = 0;
    run(fight, 6, (step) => {
      bites += fight.events.filter((e) => e.type === "hit" && e.target === me).length;
      const a = bodyOf(fight, me).pos, b = bodyOf(fight, it).pos, d = flatDist(a, b);
      const aimX = (b.x - a.x) / d, aimZ = (b.z - a.z) / d, toward = d > IN_REACH_M ? 1 : 0;
      return input({
        aimX, aimZ, moveX: aimX * toward, moveZ: aimZ * toward, locked: 0, way: step % 40 < 20 ? "lr" : "rl",
        attack: step % 2 === 0 ? "light" : null,
      });
    });
    assert.ok(bites >= 2, `${bites} bites in 6 s`);
  });

  test("a player hit by a player's sword in a duel is only hurt, not pushed", () => {
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

  test("Air still blows an enemy away, a heavier one less", () => {
    const blown = (def: EnemyDef) => {
      const fight = fightAt(def, at(0, 2));
      castNow(fight, skill(segment("nova", ["air"])));
      const from = { ...bodyOf(fight, fight.enemies[0]!).pos };
      run(fight, SETTLE_TIME);
      return flatDist(bodyOf(fight, fight.enemies[0]!).pos, from);
    };
    assert.ok(blown(PERSON) > 0.1);
    assert.ok(blown(heavier(PERSON, 0.5)) < blown(PERSON) / 2);
  });
});

describe("an enemy's block pushes it back, by the player's rule, and never stops it acting", () => {
  test("a heavy into its guard slides it back; a heavier enemy less, one with no give not at all", () => {
    const guard = (factor: number) => moved(fightAt(heavier(GUARDIAN, factor), at(0, IN_REACH_M)), "heavy");
    assert.ok(guard(1) > 0.1, `${guard(1)} m`);
    assert.ok(guard(0.5) < guard(1) / 2);
    assert.equal(guard(0), 0);
  });

  test("a light pushes less than a heavy, the push going as the hit's knockback", () => {
    const light = moved(fightAt(heavier(GUARDIAN, 1), at(0, IN_REACH_M)), "light");
    const heavy = moved(fightAt(heavier(GUARDIAN, 1), at(0, IN_REACH_M)), "heavy");
    // Slid from rest, the distance goes as the speed squared.
    const expected = heavy * (HYBRID.light.knockbackSpeed / HYBRID.heavy.knockbackSpeed) ** 2;
    assert.ok(Math.abs(light - expected) < 0.02, `${light} m, ${expected} m expected`);
  });

  test("blocking a heavy, it slides back and swings while still sliding", () => {
    const heavyLive = wayStepsAfter(WEAPONS.sword, windupTime("heavy", "opening"), true).liveAt;
    const def: EnemyDef = {
      ...SWORDSMAN, knockbackFactor: 1,
      attacks: { weapon: swings({ triggerDist: 5, firstDelay: (heavyLive + 3) * FIXED_DT }) },
    };
    const fight = fightAt(def, at(0, IN_REACH_M));
    const it = fight.enemies[0]!, enemyOf = () => fight.world.require(it, Enemy);
    let blocked = false, swungSliding = false;
    for (let i = 0; i < heavyLive + 30; i++) {
      fight.step([input({ way: "lr", attack: i === 0 ? "heavy" : null })]);
      blocked ||= fight.events.some((e) => e.type === "block" && e.target === it);
      const awayMps = bodyOf(fight, it).vel.z;
      if (blocked && enemyOf().state === "weaponWindup" && awayMps > 0.5) swungSliding = true;
    }
    assert.ok(blocked, "it blocked");
    assert.ok(swungSliding, "it wound up a swing while pushed back");
  });

  test("backed against the wall, its block lets twice the chip through", () => {
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
});

describe("a player's block pushes them back: movement only, never a lock (the user: \"you can always act\")", () => {
  const BLOCKER_FACING = { aimX: 0, aimZ: -1, locked: 0 };
  const duelAt = (blockerZ: number) => new Fight({
    arena: ARENA, duel: true, enemies: [], players: [player(at(0, blockerZ - 1.6)), player(at(0, blockerZ))],
  });
  const step = (fight: Fight, attacker: Partial<PlayerInputData>, blocker: Partial<PlayerInputData>) =>
    fight.step([input({ locked: 1, ...attacker }), input({ ...BLOCKER_FACING, ...blocker })]);

  function blockedHeavy(blockerZ: number): Fight {
    const fight = duelAt(blockerZ);
    for (let i = 0; i < SETTLE_TIME / FIXED_DT; i++) {
      step(fight, { way: "lr", attack: i === 0 ? "heavy" : null }, { block: true });
      if (fight.events.some((e) => e.type === "block" && !e.perfect && e.target === fight.players[1])) return fight;
    }
    return assert.fail("never blocked");
  }
  const OPEN_Z = 0, WALL_Z = ARENA.radius - PLAYER.radius;

  for (const [where, z] of [["on open ground", OPEN_Z], ["pinned to the wall", WALL_Z]] as const) {
    test(`${where}, the blocker can turn, step, keep blocking, attack or dodge on the very next step`, () => {
      const pushedMps = (fight: Fight) => bodyOf(fight, fight.players[1]!).vel.z;
      if (where === "on open ground") assert.ok(pushedMps(blockedHeavy(z)) > 1, "being pushed back");

      const turning = blockedHeavy(z), sideways = { aimX: 1, aimZ: 0, locked: null };
      step(turning, {}, { block: true, ...sideways });
      const me = turning.world.require(turning.players[1]!, Player);
      assert.equal(me.action, "block", "still blocking");
      assert.deepEqual(me.actionDir, { x: 1, z: 0 }, "turned");

      const stepping = blockedHeavy(z);
      step(stepping, {}, { block: true, moveX: 1 });
      assert.ok(bodyOf(stepping, stepping.players[1]!).vel.x > 0.5, "stepped sideways");

      const attacking = blockedHeavy(z);
      step(attacking, {}, { attack: "light" });
      assert.equal(attacking.world.require(attacking.players[1]!, Player).action, "attack", "swung");

      const dodging = blockedHeavy(z), from = { ...bodyOf(dodging, dodging.players[1]!).pos };
      step(dodging, {}, { dodge: true, moveX: 1 });
      assert.equal(dodging.world.require(dodging.players[1]!, Player).action, "dodge", "dodged");
      for (let i = 0; i < toSteps(PLAYER.dodge.duration); i++) step(dodging, {}, { moveX: 1 });
      assert.ok(bodyOf(dodging, dodging.players[1]!).pos.x - from.x > 1, "out from under the attacker's line");
    });
  }

  test("pinned to the wall under a chain of swings, the blocker always has a way out", () => {
    const fight = duelAt(WALL_Z), me = fight.players[1]!;
    const chain = (i: number): Partial<PlayerInputData> =>
      ({ way: i % 40 < 20 ? "lr" : "rl", attack: i % 2 === 0 ? "light" : null });
    const fork = () => {
      const copy = duelAt(WALL_Z);
      copy.load(JSON.parse(JSON.stringify(fight.save())) as ReturnType<Fight["save"]>);
      return copy;
    };
    for (let i = 0; i < 0.2 / FIXED_DT; i++) step(fight, {}, { block: true });
    let blocks = 0, brokeAt = -1, dodgesTried = 0;
    for (let i = 0; i < 4 / FIXED_DT && brokeAt < 0; i++) {
      step(fight, chain(i), { block: true });
      blocks += fight.events.filter((e) => e.type === "block" && e.target === me).length;
      if (fight.events.some((e) => e.type === "block" && e.broken && e.target === me)) brokeAt = i;
      else if (i % 3 === 0) {
        const copy = fork();
        step(copy, chain(i + 1), { dodge: true, moveX: 1 });
        assert.equal(copy.world.require(copy.players[1]!, Player).action, "dodge", `dodged out at step ${i}`);
        dodgesTried++;
      }
    }
    assert.ok(blocks >= 3 && dodgesTried > 10, `${blocks} blocks, ${dodgesTried} dodges tried`);
    assert.ok(brokeAt >= 0, "the chain drained the guard: that stagger is earned");

    for (let i = 0; fight.world.require(me, Health).hitstun > 0; i++) step(fight, chain(brokeAt + i), {});
    const from = { ...bodyOf(fight, me).pos };
    for (let i = 0; i < 0.5 / FIXED_DT; i++) {
      step(fight, chain(i), { moveX: 1 });
      assert.equal(fight.world.require(me, Health).hitstun, 0, "a landed hit doesn't stun");
    }
    assert.ok(bodyOf(fight, me).pos.x - from.x > 1, "walked out from under the chain, out of stamina");
  });
});
