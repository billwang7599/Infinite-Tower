import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  attackCost, attackShape, attackSteps, ATTACKS, COMBAT, Enemy, Player, PLAYER, Stamina, WEAPONS, Wielder,
  type AttackKind, type EnemyDef, type GuardSide, type PlayerInputData, type SwingData,
} from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import { ARENA, enemy, input, player, STATS, STATUE } from "../fixtures.js";

before(() => initPhysics());

const SWORD = WEAPONS.sword;
const NEAR = attackShape("left", PLAYER.armReachM, SWORD).range + STATUE.radius - 0.4;
const TOUGH: EnemyDef = { ...STATUE, maxHp: 10000 };
const LOCKED = { locked: 0 } as const;

const newFight = () => new Fight({
  arena: { ...ARENA, radius: NEAR + 4 },
  players: [player({ x: 0, y: 0.05, z: 0 }, {
    vitals: { hp: PLAYER.maxHp, stamina: 1000 }, stats: { ...STATS, stamina: 1000 },
  })],
  enemies: [enemy(TOUGH, { x: 0, y: 0.05, z: NEAR })],
});

interface Started { step: number; swing: SwingData; cost: number }
interface Played { fight: Fight; starts: Started[]; hits: { step: number; damage: number }[] }

type Script = (step: number, swing: SwingData | null) => Partial<PlayerInputData>;

function play(script: Script, to = 200, fight = newFight()): Played {
  const me = fight.players[0]!, stamina = fight.world.require(me, Stamina);
  const out: Played = { fight, starts: [], hits: [] };
  while (fight.steps < to) {
    const step = fight.steps + 1, before = stamina.value;
    fight.step([input(script(step, fight.world.require(me, Wielder).swing))]);
    const swing = fight.world.require(me, Wielder).swing;
    if (swing && swing.step === 1) out.starts.push({ step, swing: { ...swing }, cost: before - stamina.value });
    for (const ev of fight.events) {
      if (ev.type === "hit" && ev.team === "enemy") out.hits.push({ step, damage: ev.damage });
    }
  }
  return out;
}

function presses(kinds: AttackKind[], over: Partial<PlayerInputData> = {}): Script {
  let next = 0;
  return (step, swing) => {
    const due = next === 0 ? step === 5 : next < kinds.length && swing?.step === 2;
    return { ...over, attack: due ? kinds[next++]! : null };
  };
}

describe("an attack's timing", () => {
  test("a light lands its land time after the press, a heavy its own, every time", () => {
    for (const kind of ["light", "heavy"] as const) {
      const { starts, hits } = play((step) => ({ attack: step === 5 ? kind : null }), 120);
      assert.equal(starts[0]!.step, 5);
      assert.equal(hits[0]!.step - 5, attackSteps(SWORD, kind, 0).liveAt, kind);
    }
  });

  test("pressed during an attack, the next starts as the last one's blade is done, and lands its chain time later",
    () => {
      const { starts, hits } = play(presses(["light", "heavy"]), 150);
      assert.equal(starts[1]!.step - starts[0]!.step, starts[0]!.swing.liveUntil);
      assert.equal(starts[1]!.swing.chain, 1);
      assert.equal(hits[1]!.step - starts[1]!.step, attackSteps(SWORD, "heavy", 1).liveAt);
    });

  test(`a chain is at most ${COMBAT.maxChain}: the next waits for the last one to recover, and starts a new chain`,
    () => {
      const kinds = Array<AttackKind>(COMBAT.maxChain + 1).fill("light");
      const { starts } = play(presses(kinds), 300);
      assert.deepEqual(starts.map((s) => s.swing.chain), [...Array(COMBAT.maxChain).keys(), 0]);
      const last = starts[COMBAT.maxChain - 1]!;
      assert.equal(starts[COMBAT.maxChain]!.step - last.step, last.swing.endAt);
    });

  test("an attack after the last one has recovered starts a new chain", () => {
    const at = 5 + attackSteps(SWORD, "light", 0).endAt + 3;
    const { starts } = play((step) => ({ attack: step === 5 || step === at ? "light" : null }), 150);
    assert.deepEqual(starts.map((s) => s.swing.chain), [0, 0]);
  });
});

describe("what an attack deals and costs", () => {
  test("the weapon's damage, the heavy's factor more, the same however it's chained; each paid for", () => {
    const { starts, hits } = play(presses(["light", "heavy", "light"]), 250);
    assert.deepEqual(hits.map((h) => h.damage),
      [SWORD.damage, SWORD.damage * ATTACKS.heavy.damageFactor, SWORD.damage]);
    assert.deepEqual(starts.map((s) => s.cost), [attackCost(SWORD, "light"), attackCost(SWORD, "heavy"),
      attackCost(SWORD, "light")]);
  });

  test("its poise damage is the kind's", () => {
    const fight = newFight(), foe = fight.world.require(fight.enemies[0]!, Enemy);
    play((step) => ({ attack: step === 5 ? "heavy" : null }), 120, fight);
    assert.equal(TOUGH.poise - foe.poise, ATTACKS.heavy.poiseDamage);
  });
});

describe("the side an attack comes from", () => {
  const sideOf = (over: Partial<PlayerInputData>): GuardSide =>
    play(presses(["light"], over), 20).starts[0]!.swing.side;

  test("locked on, the guard's side", () => {
    for (const guard of ["left", "top", "right"] as const) assert.equal(sideOf({ ...LOCKED, guard }), guard);
  });

  test("unlocked, there's no guard, and attacks come from the top", () => {
    assert.equal(sideOf({ guard: "left" }), "top");
    const { fight } = play(() => ({ guard: "left" }), 10);
    assert.equal(fight.world.require(fight.players[0]!, Player).guard, null);
  });

  test("the guard stays put while an attack's blade is out, then follows again: the next attack comes from there",
    () => {
      const script = (): Script => {
        const press = presses(["light", "light"]);
        return (step, swing) => ({ ...press(step, swing), ...LOCKED, guard: step <= 5 ? "left" : "right" });
      };
      const fight = newFight();
      play(script(), 8, fight);
      assert.equal(fight.world.require(fight.players[0]!, Player).guard, "left", "mid-attack");
      assert.deepEqual(play(script(), 120).starts.map((s) => s.swing.side), ["left", "right"]);
    });
});
