import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Body, Enemy, FIXED_DT, GUARD_BREAK, guardBreakOpenTime, Health, mirrorSide, Player, PLAYER, Stamina, WeaponAttack,
  WEAPONS, Wielder, type EnemyDef, type PlayerInputData,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent, type FightSnapshot } from "@infinite-tower/shared/fight";
import {
  ARENA, dumpState, enemy, GUARDIAN, input, player, STATS, STATUE, swings, SWORDSMAN,
} from "../fixtures.js";

before(() => initPhysics());

const steps = (seconds: number) => Math.round(seconds / FIXED_DT);
const GRAB_STEPS = steps(GUARD_BREAK.grabTime);
const TECH_STEPS = steps(GUARD_BREAK.techTime);
const TOUGH: EnemyDef = { ...GUARDIAN, maxHp: 1000 };

interface Played { fight: Fight; events: FightEvent[] }

const fightWith = (def: EnemyDef, z: number) =>
  new Fight({ arena: ARENA, players: [player({ x: 0, y: 0.05, z: 0 })], enemies: [enemy(def, { x: 0, y: 0.05, z })] });

function play(def: EnemyDef, z: number, until: number, script: (step: number) => Partial<PlayerInputData>,
  fight = fightWith(def, z)): Played {
  const events: FightEvent[] = [];
  while (fight.steps < until) {
    fight.step([input(script(fight.steps + 1))]);
    events.push(...fight.events);
  }
  return { fight, events };
}

const breaking = (at: number) => (step: number) => ({ locked: 0, guard: "top" as const, guardBreak: step === at });
const results = (events: FightEvent[]) => events.flatMap((e) => (e.type === "guardBreak" ? [e.result] : []));

describe("a guard break", () => {
  test("grabs an idle foe in front through its guard; past the tech window, opens it for the grabber's heavy", () => {
    const p = play(TOUGH, 2, 5 + GRAB_STEPS + TECH_STEPS + 1, breaking(5));
    const kobold = p.fight.world.require(p.fight.enemies[0]!, Enemy);
    assert.deepEqual(results(p.events), ["grabbed", "broken"]);
    assert.equal(kobold.state, "staggered");
    assert.equal(kobold.duration, guardBreakOpenTime(WEAPONS.sword));
    assert.equal(p.fight.world.require(p.fight.players[0]!, Player).action, "none", "the grabber is free");
  });

  test("grabbed, the foe can't act; the grab lands on the step its grab time is up", () => {
    const p = play(TOUGH, 2, 5 + GRAB_STEPS - 1, breaking(5));
    assert.deepEqual(results(p.events), []);
    p.fight.step([input(breaking(5)(0))]);
    assert.deepEqual(results(p.fight.events), ["grabbed"]);
    assert.equal(p.fight.world.require(p.fight.enemies[0]!, Enemy).state, "grabbed");
  });

  test("opened, its guard is down: a heavy from the side it guarded lands", () => {
    const fight = fightWith(TOUGH, 2);
    const guarded = mirrorSide(fight.world.require(fight.enemies[0]!, WeaponAttack).guard);
    const brokenAt = 5 + GRAB_STEPS + TECH_STEPS;
    const p = play(TOUGH, 2, brokenAt + 60, (step) => ({
      locked: 0, guard: guarded, guardBreak: step === 5, attack: step === brokenAt + 1 ? "heavy" : null,
    }), fight);
    assert.ok(p.events.some((e) => e.type === "hit" && e.team === "enemy"));
    assert.ok(!p.events.some((e) => e.type === "block"));
  });

  test("costs stamina, and the grabber stands unguarded until it's done", () => {
    const p = play(TOUGH, 2, 6, breaking(5));
    const me = p.fight.players[0]!;
    assert.equal(p.fight.world.require(me, Stamina).value, STATS.stamina - GUARD_BREAK.cost);
    assert.equal(p.fight.world.require(me, Player).action, "grab");
  });

  test("with nobody in reach in front, it whiffs: busy for the whiff time, then free", () => {
    for (const z of [GUARD_BREAK.reachM + TOUGH.radius + 0.5, -2]) {
      const p = play(TOUGH, z, 5 + steps(GUARD_BREAK.whiffTime) - 1, breaking(5));
      assert.deepEqual(results(p.events), [], `at ${z}`);
      assert.equal(p.fight.world.require(p.fight.players[0]!, Player).action, "grab", `at ${z}`);
      p.fight.step([input({})]);
      assert.equal(p.fight.world.require(p.fight.players[0]!, Player).action, "none", `at ${z}`);
    }
  });

  test("a foe with no blade in hand has no guard to break: it can't be grabbed", () => {
    const p = play({ ...STATUE, maxHp: 1000 }, 2, 5 + GRAB_STEPS + 2, breaking(5));
    assert.deepEqual(results(p.events), []);
  });

  test("guard broken, it can't be grabbed again until a moment after its opening", () => {
    const brokenAt = 5 + GRAB_STEPS + TECH_STEPS;
    const safeUntil = brokenAt + steps(guardBreakOpenTime(WEAPONS.sword) + GUARD_BREAK.immuneTime);
    const again = (at: number) => results(play(TOUGH, 2, at + GRAB_STEPS + 1,
      (s) => ({ ...breaking(5)(s), guardBreak: s === 5 || s === at })).events);
    assert.deepEqual(again(safeUntil - GRAB_STEPS - 1), ["grabbed", "broken"]);
    assert.deepEqual(again(safeUntil - GRAB_STEPS + 1), ["grabbed", "broken", "grabbed"]);
  });

  test("a foe mid-attack can't be grabbed", () => {
    const attacker: EnemyDef = { ...SWORDSMAN, maxHp: 1000, attacks: { weapon: swings({ windup: 0, firstDelay: 0 }) } };
    const fight = new Fight({ arena: ARENA, players: [player({ x: 0, y: 0.05, z: 0 }, {
      vitals: { hp: 1000, stamina: STATS.stamina } })], enemies: [enemy(attacker, { x: 0, y: 0.05, z: 2 })] });
    const swing = () => fight.world.require(fight.enemies[0]!, Wielder).swing;
    while (!swing()) fight.step([input({})]);
    const p = play(attacker, 2, fight.steps + GRAB_STEPS + 2, breaking(fight.steps + 1), fight);
    assert.deepEqual(results(p.events), []);
  });
});

describe("a guard break in a duel", () => {
  const FACING_1 = { aimX: 0, aimZ: -1 };
  function duel(until: number, a: (s: number) => Partial<PlayerInputData>, b: (s: number) => Partial<PlayerInputData>) {
    const fight = new Fight({
      arena: ARENA, duel: true, enemies: [],
      players: [player({ x: 0, y: 0.05, z: 0 }), player({ x: 0, y: 0.05, z: 1.8 })],
    });
    const events: FightEvent[] = [];
    while (fight.steps < until) {
      const s = fight.steps + 1;
      fight.step([input(a(s)), input({ ...FACING_1, ...b(s) })]);
      events.push(...fight.events);
    }
    return { fight, events };
  }
  const grabbedAt = 5 + GRAB_STEPS;

  test("pressed by the one grabbed within the tech window, it's countered: both free, pushed apart", () => {
    const { fight, events } = duel(grabbedAt + 10, breaking(5), (s) => ({ guardBreak: s === grabbedAt + 8 }));
    const [me, them] = fight.players as [number, number];
    assert.deepEqual(results(events), ["grabbed", "teched"]);
    assert.equal(fight.world.require(me, Player).action, "none");
    assert.equal(fight.world.require(them, Player).action, "none");
    assert.equal(fight.world.require(them, Health).hitstun, 0);
    const gap = fight.world.require(them, Body).pos.z - fight.world.require(me, Body).pos.z;
    assert.ok(gap > 1.8, `${gap.toFixed(2)} m apart`);
  });

  test("not countered, the one grabbed staggers, guard down, and the grabber's heavy lands", () => {
    const brokenAt = grabbedAt + TECH_STEPS;
    const { fight, events } = duel(brokenAt + 70, (s) => ({ ...breaking(5)(s), attack: s === brokenAt + 1
      ? "heavy" : null }), () => ({ locked: 0, guard: "top" }));
    assert.deepEqual(results(events), ["grabbed", "broken"]);
    assert.ok(fight.world.require(fight.players[1]!, Health).hp < PLAYER.maxHp);
    assert.ok(!events.some((e) => e.type === "block"));
  });

  test("a guard break under way is in the fight's state: a copy loaded mid-grab plays on the same", () => {
    const wire = (s: FightSnapshot): FightSnapshot => JSON.parse(JSON.stringify(s));
    const heavyAt = grabbedAt + TECH_STEPS + 1;
    const a = (s: number) => ({ ...breaking(5)(s), attack: s === heavyAt ? "heavy" as const : null });
    const b = (s: number) => ({ locked: 0, guard: "left" as const, guardBreak: s === grabbedAt + 30 });
    const right = duel(grabbedAt + 5, a, b).fight, copy = duel(1, () => ({}), () => ({})).fight;
    assert.equal(right.world.require(right.players[0]!, Wielder).grab?.target, right.players[1], "mid-grab");
    copy.load(wire(right.save()));
    const from = right.steps + 1;
    for (let s = from; s < from + 120; s++) {
      for (const fight of [right, copy]) fight.step([input(a(s)), input({ ...FACING_1, ...b(s) })]);
    }
    assert.equal(dumpState(copy), dumpState(right));
  });

  test("the one grabbed can't move or act until it's over", () => {
    const { fight } = duel(grabbedAt + 3, breaking(5), (s) => ({ moveZ: s > grabbedAt ? 1 : 0, dodge: s > grabbedAt }));
    assert.equal(fight.world.require(fight.players[1]!, Player).action, "grabbed");
  });
});
