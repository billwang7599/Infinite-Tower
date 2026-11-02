import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  AVERAGE_STAT, CHAIN, emptyBag, HYBRID, lastFeintStep, MOMENTUM, momentumDamage, physicalDamage, Player, Stamina,
  strikeCost, WEAPONS, Wielder, type PlayerInputData, type Strike, type SwingDir,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ARENA, enemy, input, player, STATS, STATUE, armed } from "../fixtures.js";

before(() => initPhysics());

const SWORD = WEAPONS.sword;
const NEAR = 2;

const newFight = (at = NEAR) => new Fight({
  arena: { ...ARENA, radius: 40 },
  players: [
    player({ x: 0, y: 0.05, z: 0 }, { vitals: { hp: 100, stamina: 1000 }, stats: { ...STATS, stamina: 1000 } }),
  ],
  enemies: [enemy({ ...STATUE, maxHp: 100_000 }, { x: 0, y: 0.05, z: at })],
});

interface Played { fight: Fight; starts: number[]; lives: number[]; damage: number[]; events: FightEvent[] }

function chain(fight: Fight, presses: [Strike, SwingDir][], to = 150,
  then: (step: number) => Partial<PlayerInputData> = () => ({})): Played {
  const me = fight.players[0]!, wielder = fight.world.require(me, Wielder);
  const out: Played = { fight, starts: [], lives: [], damage: [], events: [] };
  let next = 0, pressAt = 2;
  while (fight.steps < to) {
    const step = fight.steps + 1, press = presses[next];
    const now = step === pressAt && press ? press : null;
    const way = (presses[out.starts.length] ?? presses.at(-1))?.[1] ?? "tb";
    fight.step([input({ locked: 0, way, attack: now?.[0] ?? null, ...(next >= presses.length ? then(step) : {}) })]);
    if (now) next++;
    const swing = wielder.swing;
    if (swing && swing.step === 1) {
      out.starts.push(step);
      out.lives.push(swing.liveAt);
      pressAt = step + 2;
    }
    for (const ev of fight.events) {
      out.events.push(ev);
      if (ev.type === "hit" && ev.team === "enemy") out.damage.push(ev.damage);
    }
  }
  return out;
}

const momentumOf = (fight: Fight) => fight.world.require(fight.players[0]!, Wielder).momentum;

describe("the sword's attacks", () => {
  test("go the aimed way, a stab straight ahead", () => {
    const p = chain(newFight(), [["light", "trbl"]], 3);
    assert.equal(p.fight.world.require(p.fight.players[0]!, Wielder).swing?.way, "trbl");
    const s = chain(newFight(), [["stab", "trbl"]], 3);
    assert.equal(s.fight.world.require(s.fight.players[0]!, Wielder).swing?.way, "stab");
  });

  test("the reverse chains on quickest and a perpendicular slowest", () => {
    const reverse = chain(newFight(), [["light", "lr"], ["light", "rl"]]);
    const across = chain(newFight(), [["light", "lr"], ["light", "tb"]]);
    assert.equal(reverse.starts.length, 2);
    assert.ok(reverse.lives[1]! < across.lives[1]!, `${reverse.lives[1]} vs ${across.lives[1]}`);
    assert.ok(reverse.lives[1]! < reverse.lives[0]!, "quicker than the opening");
  });

  test("a chain builds momentum, more damage each swing, and loses it after a gap", () => {
    const p = chain(newFight(), [["light", "lr"], ["light", "rl"], ["light", "lr"]], 85);
    assert.equal(momentumOf(p.fight), 2 * MOMENTUM.gain.reverse);
    assert.equal(p.damage.length, 3);
    assert.equal(p.damage[0], physicalDamage(SWORD.damage, STATS));
    assert.equal(p.damage[2], physicalDamage(SWORD.damage * momentumDamage(2 * MOMENTUM.gain.reverse), STATS));
    chain(p.fight, [], 85 + Math.ceil((CHAIN.gapTime + CHAIN.recoverTime) * 60) + 2);
    assert.equal(momentumOf(p.fight), 0);
  });

  test("a stab spends the momentum for more damage", () => {
    const fresh = chain(newFight(), [["stab", "lr"]], 40).damage[0]!;
    const spent = chain(newFight(), [["light", "lr"], ["light", "rl"], ["light", "lr"], ["stab", "lr"]], 140);
    assert.equal(fresh, physicalDamage(SWORD.damage * HYBRID.stab.damageFactor, STATS));
    assert.ok(spent.damage[3]! > fresh);
    assert.equal(momentumOf(spent.fight), 0);
  });

  test("a dodge or a block breaks the chain", () => {
    for (const then of [{ dodge: true }, { block: true }]) {
      const p = chain(newFight(), [["light", "lr"], ["light", "rl"]], 80, () => then);
      assert.equal(momentumOf(p.fight), 0, JSON.stringify(then));
    }
  });

  test("a heavy goes live later than a light, for twice its damage and its own cost", () => {
    const light = chain(newFight(), [["light", "tb"]], 60), heavy = chain(newFight(), [["heavy", "tb"]], 90);
    assert.ok(heavy.lives[0]! > light.lives[0]!);
    assert.equal(heavy.damage[0], light.damage[0]! * HYBRID.heavy.damageFactor);
    const fight = newFight(), stamina = fight.world.require(fight.players[0]!, Stamina), before = stamina.value;
    fight.step([input({ locked: 0, way: "tb", attack: "heavy" })]);
    assert.equal(stamina.value, before - strikeCost(SWORD, "heavy", AVERAGE_STAT));
  });

  test("each strike costs its own stamina", () => {
    for (const strike of ["light", "heavy", "stab"] as const) {
      const fight = newFight(30), stamina = fight.world.require(fight.players[0]!, Stamina), before = stamina.value;
      fight.step([input({ locked: 0, way: "tb", attack: strike })]);
      assert.equal(stamina.value, before - strikeCost(SWORD, strike, AVERAGE_STAT), strike);
    }
  });

  test("a greatsword is swung by its wielder's strength: the strong sooner and for less", () => {
    const swingAs = (strength: number) => {
      const fight = new Fight({
        arena: { ...ARENA, radius: 40 },
        players: [player({ x: 0, y: 0.05, z: 0 }, {
          vitals: { hp: 100, stamina: 1000 }, stats: { ...STATS, stamina: 1000, strength },
          gear: { bag: emptyBag(), equipment: { ...armed(), rightHand: "greatsword" } },
        })],
        enemies: [enemy({ ...STATUE, maxHp: 100_000 }, { x: 0, y: 0.05, z: 30 })],
      });
      const me = fight.players[0]!, stamina = fight.world.require(me, Stamina), before = stamina.value;
      fight.step([input({ locked: 0, way: "tb", attack: "light" })]);
      return { spent: before - stamina.value, liveAt: fight.world.require(me, Wielder).swing!.liveAt };
    };
    const strong = swingAs(AVERAGE_STAT * 2), average = swingAs(AVERAGE_STAT);
    assert.equal(strong.spent, strikeCost(WEAPONS.greatsword, "light", AVERAGE_STAT * 2));
    assert.equal(average.spent, strikeCost(WEAPONS.greatsword, "light", AVERAGE_STAT));
    assert.ok(strong.liveAt < average.liveAt);
  });
});

describe("a feint", () => {
  const blockAt = (strike: Strike, swingStep: (liveAt: number) => number) => {
    const fight = newFight(30), me = fight.players[0]!, wielder = fight.world.require(me, Wielder);
    fight.step([input({ locked: 0, way: "lr", attack: strike })]);
    const target = swingStep(wielder.swing!.liveAt);
    while (wielder.swing!.step < target) fight.step([input({ locked: 0, way: "lr" })]);
    const stamina = fight.world.require(me, Stamina).value;
    fight.step([input({ locked: 0, way: "lr", block: true })]);
    return { fight, me, wielder, stamina };
  };

  test("block pressed in a heavy's wind-up pulls it back into a guard, for the feint's stamina", () => {
    const { fight, me, wielder, stamina } = blockAt("heavy", () => 1);
    assert.equal(wielder.swing, null);
    assert.equal(fight.world.require(me, Player).action, "block");
    const holdCost = HYBRID.block.holdStaminaPerSec * Fight.STEP_SECONDS;
    assert.ok(Math.abs(fight.world.require(me, Stamina).value - (stamina - HYBRID.feint.cost - holdCost)) < 1e-9);
    assert.ok(fight.events.some((e) => e.type === "feint" && e.by === me));
  });

  test("opens no perfect block and ends the chain", () => {
    const fight = newFight(30), me = fight.players[0]!, wielder = fight.world.require(me, Wielder);
    fight.step([input({ locked: 0, way: "lr", attack: "light" })]);
    fight.step([input({ locked: 0, way: "rl" })]);
    fight.step([input({ locked: 0, way: "rl", attack: "heavy" })]);
    while (wielder.swing?.attack !== "heavy") fight.step([input({ locked: 0, way: "rl" })]);
    assert.ok(wielder.momentum > 0);
    fight.step([input({ locked: 0, way: "rl", block: true })]);
    assert.equal(wielder.swing, null);
    assert.equal(fight.world.require(me, Player).perfectBlockLeft, 0);
    assert.equal(wielder.momentum, 0);
    assert.equal(wielder.combo, null);
  });

  test("can't pull back a light, a stab, or a heavy in its last moment", () => {
    for (const strike of ["light", "stab"] as const) {
      const { fight, wielder } = blockAt(strike, () => 1);
      assert.notEqual(wielder.swing, null, strike);
      assert.ok(!fight.events.some((e) => e.type === "feint"), strike);
    }
    const late = blockAt("heavy", (liveAt) => lastFeintStep(liveAt) + 1);
    assert.equal(late.wielder.swing?.attack, "heavy");
    assert.ok(!late.fight.events.some((e) => e.type === "feint"));
    const last = blockAt("heavy", lastFeintStep);
    assert.equal(last.wielder.swing, null);
  });
});
