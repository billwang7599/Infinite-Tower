import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  CHAIN, FEINT, HYBRID, MOMENTUM, momentumDamage, physicalDamage, Player, Stamina, strikeCost, WEAPONS, Wielder,
  type PlayerInputData, type Strike, type SwingDir,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ARENA, enemy, input, player, STATS, STATUE } from "../../fixtures.js";

before(() => initPhysics());

const SWORD = WEAPONS.sword;
const NEAR = 2;

const newFight = (at = NEAR) => new Fight({
  arena: { ...ARENA, radius: 40 }, style: "hybrid",
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

describe("the hybrid's attacks", () => {
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
    const p = chain(newFight(), [["light", "lr"], ["light", "rl"], ["light", "lr"]], 40);
    assert.equal(momentumOf(p.fight), 2 * MOMENTUM.gain.reverse);
    assert.equal(p.damage.length, 3);
    assert.equal(p.damage[0], physicalDamage(SWORD.damage, STATS));
    assert.equal(p.damage[2], physicalDamage(SWORD.damage * momentumDamage(2 * MOMENTUM.gain.reverse), STATS));
    chain(p.fight, [], 40 + Math.ceil((CHAIN.gapTime + CHAIN.recoverTime) * 60) + 2);
    assert.equal(momentumOf(p.fight), 0);
  });

  test("a stab spends the momentum for more damage", () => {
    const fresh = chain(newFight(), [["stab", "lr"]], 40).damage[0]!;
    const spent = chain(newFight(), [["light", "lr"], ["light", "rl"], ["light", "lr"], ["stab", "lr"]], 80);
    assert.equal(fresh, physicalDamage(SWORD.damage * HYBRID.stab.damageFactor, STATS));
    assert.ok(spent.damage[3]! > fresh);
    assert.equal(momentumOf(spent.fight), 0);
  });

  test("a dodge or a block breaks the chain", () => {
    for (const then of [{ dodge: true }, { block: true }]) {
      const p = chain(newFight(), [["light", "lr"], ["light", "rl"]], 40, () => then);
      assert.equal(momentumOf(p.fight), 0, JSON.stringify(then));
    }
  });

  test("a heavy goes live later than a light, for twice its damage and its own cost", () => {
    const light = chain(newFight(), [["light", "tb"]], 60), heavy = chain(newFight(), [["heavy", "tb"]], 90);
    assert.ok(heavy.lives[0]! > light.lives[0]!);
    assert.equal(heavy.damage[0], light.damage[0]! * HYBRID.heavy.damageFactor);
    const fight = newFight(), stamina = fight.world.require(fight.players[0]!, Stamina), before = stamina.value;
    fight.step([input({ locked: 0, way: "tb", attack: "heavy" })]);
    assert.equal(stamina.value, before - strikeCost(SWORD, "heavy"));
  });

  test("the kick in a heavy's wind-up feints it, for the feint's stamina; a light is too quick to feint", () => {
    const fight = newFight(30), me = fight.players[0]!;
    fight.step([input({ locked: 0, way: "tb", attack: "heavy" })]);
    const stamina = fight.world.require(me, Stamina).value;
    fight.step([input({ locked: 0, way: "tb", kick: true })]);
    assert.equal(fight.world.require(me, Wielder).swing, null);
    assert.equal(fight.world.require(me, Player).action, "none");
    assert.equal(fight.world.require(me, Stamina).value, stamina - FEINT.cost);
    assert.ok(fight.events.some((e) => e.type === "feint" && e.by === me));

    const quick = newFight(30);
    quick.step([input({ locked: 0, way: "tb", attack: "light" })]);
    quick.step([input({ locked: 0, way: "tb", kick: true })]);
    assert.notEqual(quick.world.require(quick.players[0]!, Wielder).swing, null);
  });
});
