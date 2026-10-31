import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { Body, Enemy, Health, OneStrike, ONE_STRIKE, toSteps, type EnemyDef, type Line } from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ARENA, BITER, BOAR, enemy, FULL_HP, input, player, STATUE } from "../../fixtures.js";

before(() => initPhysics());

const BEAST_STATUE: EnemyDef = { ...STATUE, beast: true };
const lunging = (line: Line, beast: boolean): EnemyDef =>
  ({ ...BITER, beast, attacks: { lunge: { ...BITER.attacks.lunge!, line } } });
const CHARGER: EnemyDef = {
  ...BOAR, beast: true, attacks: { ...BOAR.attacks, lunge: { ...BOAR.attacks.lunge!, line: "low" } },
};

function play(def: EnemyDef, steps: number, script: (s: number, fight: Fight) => object, at = 2.4, from = 0) {
  const fight = new Fight({
    arena: ARENA, style: "one-strike", players: [player({ x: 0, y: 0.05, z: from })],
    enemies: [enemy(def, { x: 0, y: 0.05, z: from + at })],
  });
  const events: FightEvent[] = [];
  for (let i = 0; i < steps; i++) {
    fight.step([input({ locked: 0, ...script(fight.steps + 1, fight) })]);
    events.push(...fight.events);
  }
  return { fight, events, me: fight.players[0]!, it: fight.enemies[0]! };
}

const thrustAt = (line: Line) => (s: number) => ({ line, attack: s === 20 ? "light" as const : null });
const lost = (fight: Fight, e: number) => {
  const h = fight.world.require(e, Health);
  return (h.max - h.hp) / h.max;
};

describe("beasts and the Warlock in One Strike", () => {
  test("only blade holders hold a line: the boar and a staff don't", () => {
    const { fight, me, it } = play(BEAST_STATUE, 1, () => ({}));
    assert.ok(fight.world.has(me, OneStrike));
    assert.ok(!fight.world.has(it, OneStrike));
  });

  test("the boar's low line is its head, its middle its back; a high thrust passes over it", () => {
    for (const line of ["low", "middle", "high"] as const) {
      const { fight, it } = play(BEAST_STATUE, 60, thrustAt(line));
      assert.ok(Math.abs(lost(fight, it) - (ONE_STRIKE.zones.beast[line] ?? 0)) < 1e-6, line);
    }
  });

  test("anyone else has a person's lines: the head kills", () => {
    const { fight, it } = play(STATUE, 60, thrustAt("high"));
    assert.equal(lost(fight, it), 1);
  });

  test("the boar's lunge comes on the low line: a low blade facing it clashes it, and it recoils", () => {
    const held = play(lunging("low", true), 40, () => ({ line: "low" }));
    assert.equal(held.fight.world.require(held.me, Health).hp, FULL_HP);
    assert.ok(held.events.some((e) => e.type === "strike" && e.what === "clash" && e.by === held.it));
    assert.equal(held.fight.world.require(held.it, Enemy).state, "recoil");
    const middle = play(lunging("low", true), 40, () => ({}));
    assert.ok(middle.fight.world.require(middle.me, Health).hp < FULL_HP);
  });

  test("the Warlock's poke is a middle thrust: a middle blade clashes it, or one moving there; no disarm", () => {
    const held = play(lunging("middle", false), 40, () => ({}));
    assert.equal(held.fight.world.require(held.me, Health).hp, FULL_HP);
    const landsAt = toSteps(BITER.attacks.lunge!.windup) + 2;
    const moving = play(lunging("middle", false), 40, (s) => ({ line: s >= landsAt - 2 ? "middle" : "high" }));
    assert.equal(moving.fight.world.require(moving.me, Health).hp, FULL_HP);
    assert.ok(!moving.events.some((e) => e.type === "strike" && e.what === "disarm"));
  });

  test("charging onto a blade held low long enough, facing it, it impales itself; you're pushed back unhurt", () => {
    const { fight, events, me, it } = play(CHARGER, 240, () => ({ line: "low" }), 14, -7);
    assert.ok(events.some((e) => e.type === "strike" && e.what === "impale" && e.by === me));
    assert.equal(fight.world.require(it, Health).hp, 0);
    assert.equal(fight.world.require(me, Health).hp, FULL_HP);
  });

  test("not on a blade at another line, nor one just lowered", () => {
    const middle = play(CHARGER, 240, () => ({}), 14, -7);
    assert.ok(middle.fight.world.require(middle.me, Health).hp < FULL_HP);
    assert.ok(middle.fight.world.require(middle.it, Health).hp > 0);
    const late = play(CHARGER, 240, (_s, f) => {
      const boar = f.world.require(f.enemies[0]!, Body).pos.z, mine = f.world.require(f.players[0]!, Body).pos.z;
      return { line: boar - mine < 3 ? "low" : "middle" };
    }, 14, -7);
    assert.ok(late.fight.world.require(late.it, Health).hp > 0);
    assert.ok(late.fight.world.require(late.me, Health).hp < FULL_HP);
  });
});
