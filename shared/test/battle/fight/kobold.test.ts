import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  attackSteps, Body, Enemy, FIXED_DT, Health, WeaponAttack, WEAPONS, Wielder, type AttackKind, type EnemyDef,
  type GuardSide,
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

interface Attack {
  attack: AttackKind;
  side: GuardSide;
  guardBefore: GuardSide;
  windupSteps: number;
  chain: number;
  liveAfter: number;
}

function chains(seed: number, seconds = 30): Attack[][] {
  const fight = newFight(seed), e = fight.enemies[0]!;
  const state = () => fight.world.require(e, Enemy).state, guard = () => fight.world.require(e, WeaponAttack).guard;
  const out: Attack[][] = [];
  let windupSteps = 0, guardBefore = guard();
  for (let i = 0; i < seconds / FIXED_DT; i++) {
    const before = state(), was = guard();
    fight.step([IDLE]);
    const now = state();
    if (now === "weaponWindup" && before !== "weaponWindup") {
      windupSteps = 0;
      guardBefore = was;
      if (before === "approach") out.push([]);
    }
    if (now === "weaponWindup") windupSteps++;
    if (now === "weapon" && before !== "weapon") {
      const swing = fight.world.require(e, Wielder).swing!;
      out.at(-1)!.push({
        attack: swing.attack, side: swing.side, guardBefore, windupSteps, chain: swing.chain, liveAfter: swing.liveAt,
      });
    }
  }
  return out;
}

describe("the swordsman's chains", () => {
  test("two or three attacks each, each from its guard's side, moved to another side before every attack", () => {
    const all = chains(7).slice(0, -1); // the last may still be going
    assert.ok(all.length >= 5, `${all.length} chains`);
    for (const c of all) {
      assert.ok(c.length >= DEF.minChain && c.length <= DEF.maxChain, `a chain of ${c.length}`);
      for (const a of c) assert.notEqual(a.side, a.guardBefore, "it switched first");
    }
    assert.ok(all.some((c) => c.length === 2) && all.some((c) => c.length === 3), "both lengths happen");
  });

  test("its guard is on the attack's side while it winds up", () => {
    const fight = newFight(4), e = fight.enemies[0]!;
    for (let i = 0; i < 10 / FIXED_DT; i++) {
      fight.step([IDLE]);
      const swing = fight.world.require(e, Wielder).swing;
      if (swing && swing.step === 1) assert.equal(swing.side, fight.world.require(e, WeaponAttack).guard);
    }
  });

  test("it holds its wind-up first (the chain wind-up after), then attacks at the fixed timings", () => {
    const near = (steps: number, time: number) => Math.abs(steps - time / FIXED_DT) <= 1;
    for (const c of chains(3).slice(0, -1)) {
      c.forEach((a, i) => {
        assert.ok(near(a.windupSteps, i === 0 ? DEF.windup : DEF.chainWindup), `${a.windupSteps} steps`);
        assert.equal(a.chain, i);
        assert.equal(a.liveAfter, attackSteps(WEAPONS.sword, a.attack, i).liveAt);
      });
    }
  });

  test("the same seed gives the same attacks; another seed, others; light and heavy both", () => {
    assert.deepEqual(chains(11), chains(11));
    assert.notDeepEqual(chains(11), chains(12));
    const all = chains(5, 60).flat();
    assert.ok(all.some((a) => a.attack === "heavy") && all.some((a) => a.attack === "light"));
    assert.equal(new Set(all.map((a) => a.side)).size, 3, "from every side");
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
