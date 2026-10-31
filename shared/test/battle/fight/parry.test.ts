import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  Enemy, FIXED_DT, GUARD_SIDES, Health, mirrorSide, parryOpenTime, PARRY, Player, PLAYER, Stamina,
  WEAPONS, Wielder, type AttackKind, type EnemyDef, type GuardSide, type PlayerInputData,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ARENA, BITER, enemy, input, player, STATS, swings, SWORDSMAN } from "./fixtures.js";

// Before the describes: they run fights to find when the attacks land.
await initPhysics();

const WINDOW_STEPS = Math.round(PARRY.windowTime / FIXED_DT);
const SWORD = WEAPONS.sword;
const swordsman = (attack: AttackKind): EnemyDef =>
  ({ ...SWORDSMAN, maxHp: 1000, attacks: { weapon: swings({ heavyShare: attack === "heavy" ? 1 : 0 }) } });

interface Played { fight: Fight; events: FightEvent[] }

function play(def: EnemyDef, steps: number, script: (step: number) => Partial<PlayerInputData>, z = 2): Played {
  const fight = new Fight({
    arena: ARENA, players: [player({ x: 0, y: 0.05, z: 0 })], enemies: [enemy(def, { x: 0, y: 0.05, z })],
  });
  const events: FightEvent[] = [];
  while (fight.steps < steps) {
    fight.step([input(script(fight.steps + 1))]);
    events.push(...fight.events);
  }
  return { fight, events };
}

function firstAttack(def: EnemyDef): { side: GuardSide; landsAt: number } {
  const fight = play(def, 0, () => ({})).fight;
  let side: GuardSide | null = null;
  while (!fight.events.some((e) => e.type === "hit")) {
    fight.step([input({})]);
    side ??= fight.world.require(fight.enemies[0]!, Wielder).swing?.side ?? null;
  }
  return { side: side!, landsAt: fight.steps };
}

const parrying = (side: GuardSide, pressAt: number, attack: AttackKind = "heavy") => (step: number) =>
  ({ locked: 0, guard: mirrorSide(side), attack: step === pressAt ? attack : null });
const hp = (p: Played) => p.fight.world.require(p.fight.players[0]!, Health).hp;

describe("a parry", () => {
  for (const kind of ["light", "heavy"] as const) {
    const its = firstAttack(swordsman(kind));
    test(`a heavy pressed within the window before a ${kind} lands, from the guard across it, parries it`, () => {
      for (const pressAt of [its.landsAt - WINDOW_STEPS, its.landsAt]) {
        const p = play(swordsman(kind), its.landsAt + 2, parrying(its.side, pressAt));
        const me = p.fight.players[0]!, kobold = p.fight.enemies[0]!;
        assert.ok(p.events.some((e) => e.type === "parry" && e.by === me && e.target === kobold), `at ${pressAt}`);
        assert.equal(hp(p), PLAYER.maxHp);
        assert.equal(p.fight.world.require(kobold, Enemy).state, "staggered");
        assert.equal(p.fight.world.require(kobold, Wielder).swing, null, "its attack is over");
        assert.equal(p.fight.world.require(me, Wielder).swing, null, "the parrying heavy is spent on the parry");
        assert.equal(p.fight.world.require(me, Player).action, "none");
        assert.equal(p.fight.world.require(me, Stamina).value, STATS.stamina, "the heavy's stamina back");
      }
    });

    test(`parrying a ${kind} opens the attacker for the parrier's light to land, and a little more`, () => {
      const parriedAt = its.landsAt;
      const p = play(swordsman(kind), parriedAt + 1, parrying(its.side, parriedAt));
      const kobold = p.fight.world.require(p.fight.enemies[0]!, Enemy);
      assert.equal(kobold.duration, parryOpenTime(SWORD, kind));
      const fight = p.fight, guard = mirrorSide(its.side);
      while (!fight.events.some((e) => e.type === "hit") && fight.steps < parriedAt + 60) {
        fight.step([input({ locked: 0, guard, attack: fight.steps === parriedAt + 1 ? "light" : null })]);
      }
      assert.ok(fight.events.some((e) => e.type === "hit" && e.team === "enemy"), "the light lands");
      assert.equal(kobold.state, "staggered", "still open when it lands");
    });
  }

  test("a parried light opens the attacker for less than a parried heavy", () => {
    assert.ok(parryOpenTime(SWORD, "light") < parryOpenTime(SWORD, "heavy"));
  });

  test("pressed before the window, the heavy is only an attack: theirs lands first", () => {
    const its = firstAttack(swordsman("light"));
    const p = play(swordsman("light"), its.landsAt + 2, parrying(its.side, its.landsAt - WINDOW_STEPS - 1));
    assert.ok(!p.events.some((e) => e.type === "parry"));
    assert.ok(hp(p) < PLAYER.maxHp);
  });

  test("from either other guard, it isn't a parry", () => {
    const its = firstAttack(swordsman("light"));
    for (const side of GUARD_SIDES.filter((s) => s !== its.side)) {
      const p = play(swordsman("light"), its.landsAt + 2, parrying(side, its.landsAt - 3));
      assert.ok(!p.events.some((e) => e.type === "parry"), side);
      assert.ok(hp(p) < PLAYER.maxHp, side);
    }
  });

  test("a light in the window doesn't parry", () => {
    const its = firstAttack(swordsman("light"));
    const p = play(swordsman("light"), its.landsAt + 2, parrying(its.side, its.landsAt - 3, "light"));
    assert.ok(!p.events.some((e) => e.type === "parry"));
    assert.ok(hp(p) < PLAYER.maxHp);
  });

  test("a body blow can't be parried", () => {
    const p = play(BITER, 60, (step) => ({ locked: 0, guard: "top", attack: step % 10 === 0 ? "heavy" : null }), 2.4);
    assert.ok(!p.events.some((e) => e.type === "parry"));
    assert.ok(hp(p) < PLAYER.maxHp);
  });
});

describe("a parry in a duel", () => {
  const FACING_1 = { aimX: 0, aimZ: -1 };
  const pvp = () => new Fight({
    arena: ARENA, duel: true, enemies: [],
    players: [player({ x: 0, y: 0.05, z: 0 }), player({ x: 0, y: 0.05, z: 2 })],
  });
  const LANDS = Math.round(0.45 / FIXED_DT);

  function duel(steps: number, a: (s: number) => Partial<PlayerInputData>, b: (s: number) => Partial<PlayerInputData>) {
    const fight = pvp(), events: FightEvent[] = [];
    while (fight.steps < steps) {
      const s = fight.steps + 1;
      fight.step([input(a(s)), input({ ...FACING_1, ...b(s) })]);
      events.push(...fight.events);
    }
    return { fight, events };
  }

  test("the parried player staggers, guard down, and the parrier's light lands", () => {
    const attacker = (s: number) => ({ locked: 0, guard: "left" as const, attack: s === 1 ? "light" as const : null });
    const landsAt = 1 + LANDS;
    const { fight, events } = duel(landsAt + 1, (s) => ({ locked: 1, guard: "right", attack: s === landsAt - 2
      ? "heavy" : null }), attacker);
    const [me, them] = fight.players as [number, number];
    assert.ok(events.some((e) => e.type === "parry" && e.by === me && e.target === them));
    assert.equal(fight.world.require(them, Player).action, "stagger");
    assert.equal(fight.world.require(them, Health).hitstun, parryOpenTime(SWORD, "light") - FIXED_DT);
    const after = duel(landsAt + 60, (s) => ({
      locked: 1, guard: "right", attack: s === landsAt - 2 ? "heavy" : s === landsAt + 1 ? "light" : null,
    }), attacker);
    assert.ok(after.fight.world.require(after.fight.players[1]!, Health).hp < PLAYER.maxHp);
    assert.equal(after.fight.world.require(after.fight.players[0]!, Health).hp, PLAYER.maxHp);
  });
});
