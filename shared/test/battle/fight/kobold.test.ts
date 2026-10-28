/** The swordsman's attacks: chains of two or three swings, picked by a random number generator kept in the fight. */
import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Body, Enemy, FIXED_DT, Health, followingBlade, planSwing, restingBlade, SWING_DIRS, WEAPONS, Wielder, type AttackKind,
  type EnemyDef,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightSnapshot } from "@infinite-tower/shared/fight";
import { ARENA, dumpState, enemy, IDLE, player, swings, SWORDSMAN } from "./fixtures.js";

before(() => initPhysics());

/** Like the Kobold: chains of 2 or 3 of any attack, attacking again soon after. */
const CHAINER: EnemyDef = {
  ...SWORDSMAN, maxHp: 10000,
  attacks: { weapon: swings({ moves: [...SWING_DIRS, "stab"], minChain: 2, maxChain: 3, cooldown: 0.4 }) },
};
const DEF = CHAINER.attacks.weapon!;

const newFight = (seed: number) => new Fight({
  arena: ARENA, players: [player({ x: 0, y: 0.05, z: 0 }, { vitals: { hp: 100000, stamina: 100 } })],
  enemies: [{ ...enemy(CHAINER, { x: 0, y: 0.05, z: 2 }), seed }],
});

interface Swing { attack: AttackKind; windupSteps: number }

/** Its chains over `seconds`: each a list of its swings, with how many steps each one's wind-up took. */
function chains(seed: number, seconds = 30): Swing[][] {
  const fight = newFight(seed);
  const state = () => fight.world.require(fight.enemies[0]!, Enemy).state;
  const out: Swing[][] = [];
  let windupSteps = 0;
  for (let i = 0; i < seconds / FIXED_DT; i++) {
    const before = state();
    fight.step([IDLE]);
    const now = state();
    if (now === "weaponWindup" && before !== "weaponWindup") {
      windupSteps = 0;
      if (before === "approach") out.push([]);
    }
    if (now === "weaponWindup") windupSteps++;
    if (now === "weapon" && before !== "weapon") {
      out.at(-1)!.push({ attack: fight.world.require(fight.enemies[0]!, Wielder).swing!.attack, windupSteps });
    }
  }
  return out;
}

describe("the swordsman's chains", () => {
  test("two or three swings each, every one different from the one before", () => {
    const all = chains(7).slice(0, -1); // the last may still be going
    assert.ok(all.length >= 5, `${all.length} chains`);
    for (const c of all) {
      assert.ok(c.length >= DEF.minChain && c.length <= DEF.maxChain, `a chain of ${c.length}`);
      for (let i = 1; i < c.length; i++) assert.notEqual(c[i]!.attack, c[i - 1]!.attack);
    }
    assert.ok(all.some((c) => c.length === 2) && all.some((c) => c.length === 3), "both lengths happen");
  });

  test("the first swing winds up for its wind-up, the chained ones for the chain wind-up or the blade's own", () => {
    const near = (steps: number, time: number) => Math.abs(steps - time / FIXED_DT) <= 1;
    const strength = CHAINER.stats.strength;
    for (const c of chains(3).slice(0, -1)) {
      assert.ok(near(c[0]!.windupSteps, DEF.windup), `${c[0]!.windupSteps} steps`);
      let last = planSwing(WEAPONS.sword, strength, restingBlade(), c[0]!.attack);
      for (let i = 1; i < c.length; i++) {
        const plan = planSwing(WEAPONS.sword, strength, followingBlade(c[i - 1]!.attack, last.flow), c[i]!.attack);
        const want = Math.max(DEF.chainWindup, plan.windupTime);
        assert.ok(near(c[i]!.windupSteps, want), `${c[i]!.windupSteps} steps, not ${want / FIXED_DT}`);
        last = plan;
      }
    }
  });

  test("a wind-up is never quicker than the blade can get to the swing's start", () => {
    const hasty: EnemyDef = {
      ...CHAINER,
      attacks: { weapon: swings({ moves: ["lr", "rl"], minChain: 2, maxChain: 2, windup: 0, chainWindup: 0 }) },
    };
    const fight = new Fight({
      arena: ARENA, players: [player({ x: 0, y: 0.05, z: 0 }, { vitals: { hp: 100000, stamina: 100 } })],
      enemies: [enemy(hasty, { x: 0, y: 0.05, z: 2 })],
    });
    const windups: number[] = [];
    for (let i = 0; i < 120; i++) {
      const was = fight.world.require(fight.enemies[0]!, Enemy).state;
      fight.step([IDLE]);
      const now = fight.world.require(fight.enemies[0]!, Enemy);
      if (now.state === "weaponWindup" && was !== "weaponWindup") windups.push(now.duration);
    }
    const first = planSwing(WEAPONS.sword, CHAINER.stats.strength, restingBlade(), "lr");
    const second = planSwing(WEAPONS.sword, CHAINER.stats.strength, followingBlade("lr", first.flow), "rl");
    assert.deepEqual(windups.slice(0, 2), [first.windupTime, second.windupTime]);
  });

  test("its chained swings carry the blade on as the player's do: one on the same way hits harder", () => {
    const flowing: EnemyDef = {
      ...CHAINER, attacks: { weapon: swings({ moves: ["lr", "tlbr"], minChain: 2, maxChain: 2, chainWindup: 0.8 }) },
    };
    const fight = new Fight({
      arena: ARENA, players: [player({ x: 0, y: 0.05, z: 0 }, { vitals: { hp: 100000, stamina: 100 } })],
      enemies: [enemy(flowing, { x: 0, y: 0.05, z: 2 })],
    });
    const hits: number[] = [];
    for (let i = 0; i < 300 && hits.length < 2; i++) {
      fight.step([IDLE]);
      for (const ev of fight.events) if (ev.type === "hit" && ev.team === "player") hits.push(ev.damage);
    }
    const first = planSwing(WEAPONS.sword, CHAINER.stats.strength, restingBlade(), "lr");
    const second = planSwing(WEAPONS.sword, CHAINER.stats.strength, followingBlade("lr", first.flow), "tlbr");
    assert.equal(hits[0], WEAPONS.sword.damage);
    assert.equal(hits[1], WEAPONS.sword.damage * second.momentum);
    assert.ok(hits[1]! > hits[0]!);
  });

  test("the same seed gives the same swings; another seed, others", () => {
    assert.deepEqual(chains(11), chains(11));
    assert.notDeepEqual(chains(11), chains(12));
    const kinds = new Set(chains(5, 60).flat().map((s) => s.attack));
    assert.ok(kinds.size >= 6, `${kinds.size} kinds of attack seen`);
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

describe("the swordsman's swing landing", () => {
  test("hurts the player without stunning or knocking them back, like the player's own swing", () => {
    const fight = newFight(1);
    const me = fight.players[0]!, health = fight.world.require(me, Health);
    for (let i = 0; i < 10 / FIXED_DT && health.hp === 100000; i++) fight.step([IDLE]);
    assert.ok(health.hp < 100000, "hit");
    assert.equal(health.hitstun, 0);
    const vel = fight.world.require(me, Body).vel;
    assert.ok(Math.hypot(vel.x, vel.y, vel.z) < 0.01, "not knocked back");
  });
});
