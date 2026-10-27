/** The swordsman's attacks: chains of two or three swings, picked by a random number generator kept in the fight. */
import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { Body, Enemy, FIXED_DT, Health, SWING_DIRS, SwordAttack, type AttackKind, type EnemyDef } from "@infinite-tower/shared";
import { Fight, initPhysics, type FightSnapshot } from "@infinite-tower/shared/fight";
import { ARENA, dumpState, enemy, IDLE, player, sword, SWORDSMAN } from "./fixtures.js";

before(() => initPhysics());

/** Like the Kobold: chains of 2 or 3 of any attack, attacking again soon after. */
const CHAINER: EnemyDef = {
  ...SWORDSMAN, maxHp: 10000,
  attacks: { sword: sword({ moves: [...SWING_DIRS, "stab"], minChain: 2, maxChain: 3, cooldown: 0.4 }) },
};
const DEF = CHAINER.attacks.sword!;

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
    if (now === "swordWindup" && before !== "swordWindup") {
      windupSteps = 0;
      if (before === "approach") out.push([]);
    }
    if (now === "swordWindup") windupSteps++;
    if (now === "sword" && before !== "sword") {
      out.at(-1)!.push({ attack: fight.world.require(fight.enemies[0]!, SwordAttack).attack, windupSteps });
    }
  }
  return out;
}

describe("the swordsman's chains", () => {
  test("two or three swings each, every one different from the one before", () => {
    const all = chains(7);
    assert.ok(all.length >= 5, `${all.length} chains`);
    for (const c of all) {
      assert.ok(c.length >= DEF.minChain && c.length <= DEF.maxChain, `a chain of ${c.length}`);
      for (let i = 1; i < c.length; i++) assert.notEqual(c[i]!.attack, c[i - 1]!.attack);
    }
    assert.ok(all.some((c) => c.length === 2) && all.some((c) => c.length === 3), "both lengths happen");
  });

  test("the first swing winds up for its wind-up, the ones it chains into for the shorter chain wind-up", () => {
    const near = (steps: number, time: number) => Math.abs(steps - time / FIXED_DT) <= 1;
    for (const c of chains(3)) {
      assert.ok(near(c[0]!.windupSteps, DEF.windup), `${c[0]!.windupSteps} steps`);
      for (const s of c.slice(1)) assert.ok(near(s.windupSteps, DEF.chainWindup), `${s.windupSteps} steps`);
    }
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
