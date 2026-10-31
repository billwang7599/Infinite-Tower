import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Body, Enemy, FIXED_DT, Health, Wielder, type AttackKind, type EnemyDef, type Way,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightSnapshot } from "@infinite-tower/shared/fight";
import { ARENA, dumpState, enemy, IDLE, player, swings, SWORDSMAN } from "./fixtures.js";

before(() => initPhysics());

const CHAINER: EnemyDef = {
  ...SWORDSMAN, maxHp: 10000,
  attacks: { weapon: swings({ minChain: 2, maxChain: 3, heavyShare: 0.4, cooldown: 0.4 }) },
};
const DEF = CHAINER.attacks.weapon!;

const newFight = (seed: number) => new Fight({
  arena: ARENA, players: [player({ x: 0, y: 0.05, z: 0 }, { vitals: { hp: 100000, stamina: 100 } })],
  enemies: [{ ...enemy(CHAINER, { x: 0, y: 0.05, z: 2 }), seed }],
});

interface Attack { attack: AttackKind; way: Way }

function chains(seed: number, seconds = 30): Attack[][] {
  const fight = newFight(seed), e = fight.enemies[0]!;
  const out: Attack[][] = [];
  let before = fight.world.require(e, Enemy).state;
  for (let i = 0; i < seconds / FIXED_DT; i++) {
    fight.step([IDLE]);
    const swing = fight.world.require(e, Wielder).swing;
    if (swing?.step === 1) {
      if (before === "approach") out.push([]);
      out.at(-1)!.push({ attack: swing.attack, way: swing.way });
    }
    before = fight.world.require(e, Enemy).state;
  }
  return out;
}

describe("the swordsman's chains", () => {
  test("two or three swings each, never the same way twice running", () => {
    const all = chains(7).slice(0, -1);
    assert.ok(all.length >= 5, `${all.length} chains`);
    for (const c of all) {
      assert.ok(c.length >= DEF.minChain && c.length <= DEF.maxChain, `a chain of ${c.length}`);
      c.slice(1).forEach((a, i) => assert.notEqual(a.way, c[i]!.way));
    }
    assert.ok(all.some((c) => c.length === 2) && all.some((c) => c.length === 3), "both lengths happen");
  });

  test("the same seed gives the same swings; another seed, others; light and heavy both", () => {
    assert.deepEqual(chains(11), chains(11));
    assert.notDeepEqual(chains(11), chains(12));
    const all = chains(5, 60).flat();
    assert.ok(all.some((a) => a.attack === "heavy") && all.some((a) => a.attack === "light"));
  });

  test("its random numbers are in the fight's state: a copy loaded mid-chain goes on the same", () => {
    const wire = (s: FightSnapshot): FightSnapshot => JSON.parse(JSON.stringify(s));
    for (const at of [50, 97, 160, 333]) {
      const right = newFight(9);
      for (let i = 0; i < at; i++) right.step([IDLE]);
      const copy = newFight(1);
      copy.load(wire(right.save()));
      for (let i = 0; i < 600; i++) {
        right.step([IDLE]);
        copy.step([IDLE]);
      }
      assert.equal(dumpState(copy), dumpState(right), `loaded at ${at}`);
    }
  });
});

describe("the swordsman's attack landing", () => {
  test("hurts the player without stunning or knocking them back, like the player's own", () => {
    const fight = newFight(1);
    const me = fight.players[0]!, health = fight.world.require(me, Health);
    for (let i = 0; i < 10 / FIXED_DT && health.hp === 100000; i++) fight.step([IDLE]);
    assert.ok(health.hp < 100000, "hit");
    assert.equal(health.hitstun, 0);
    const vel = fight.world.require(me, Body).vel;
    assert.ok(Math.hypot(vel.x, vel.y, vel.z) < 0.01, "not knocked back");
  });
});
