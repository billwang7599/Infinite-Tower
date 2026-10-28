/** Chaining swings: how fast the next one starts, and the momentum a chain builds and loses. */
import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  ActiveHit, attackShape, CHAIN, FIXED_DT, MOMENTUM, physicalDamage, Player, PLAYER, startupTime,
  WEAPONS, Wielder, type AttackKind, type EnemyDef, type PlayerData, type PlayerInputData, type WielderData,
} from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import { ARENA, BITER, enemy, input, player, STATS, STATUE } from "../fixtures.js";

before(() => initPhysics());

const BASE_DAMAGE = physicalDamage(WEAPONS.sword.damage, STATS);
/** Steps from a time in seconds, the way the fight counts them. */
const steps = (time: number) => Math.ceil(time / FIXED_DT - 1e-9);
/** The longest a swing holds off the next one. */
const SLOWEST_SWING = CHAIN.startupTime.perpendicular + CHAIN.activeTime;
/** A statue right in front, in reach of every attack; or far away, out of reach of all. */
const NEAR = attackShape("lr", PLAYER.armReachM, WEAPONS.sword).range + STATUE.radius - 0.4;
const FAR = 30;

/** Stamina enough for any chain here. */
const newFight = (at = NEAR, def: EnemyDef = STATUE) => new Fight({
  arena: { radius: Math.max(ARENA.radius, at + 2) },
  players: [player({ x: 0, y: 0.05, z: 0 }, {
    vitals: { hp: PLAYER.maxHp, stamina: 1000 }, stats: { ...STATS, stamina: 1000 },
  })],
  enemies: [enemy(def, { x: 0, y: 0.05, z: at })],
});

/** What the player does on a step, seeing how they stood after the last one. */
type Script = (step: number, me: PlayerData, wielder: WielderData) => Partial<PlayerInputData>;

interface Played {
  fight: Fight;
  /** The steps each attack started on, and the steps its blade went live on. */
  starts: number[];
  live: number[];
  /** Each hit on the enemy's damage; the momentum after each step; the steps the player was hit on. */
  damage: number[];
  momentum: number[];
  hurt: number[];
}

function play(script: Script, to = 200, fight = newFight()): Played {
  const me = fight.players[0]!;
  const out: Played = { fight, starts: [], live: [], damage: [], momentum: [], hurt: [] };
  let hadHit = false;
  while (fight.steps < to) {
    const step = fight.steps + 1;
    const wielder = fight.world.require(me, Wielder);
    fight.step([input(script(step, fight.world.require(me, Player), wielder))]);
    if (wielder.swing && wielder.swing.step <= 1) out.starts.push(step);
    const hit = fight.world.has(me, ActiveHit);
    if (hit && !hadHit) out.live.push(step);
    hadHit = hit;
    for (const ev of fight.events) {
      if (ev.type === "hit" && ev.team === "enemy") out.damage.push(ev.damage);
      if (ev.type === "hit" && ev.team === "player") out.hurt.push(step);
    }
    out.momentum.push(wielder.momentum);
  }
  return out;
}

/**
 * Presses each of `kinds` in turn (a tap each): the first on step 5, each next one on the step after the last one
 * started, so it waits (buffered) for the chain point. `then` takes over once they're all pressed.
 */
function chainOf(kinds: AttackKind[], then: Script = () => ({})): Script {
  let next = 0;
  return (step, me, wielder) => {
    const swing = wielder.swing, lastStarted = swing !== null && swing.step <= 1 && swing.attack === kinds[next - 1];
    const due = (next === 0 && step === 5) || (next > 0 && next < kinds.length && lastStarted);
    if (due) return { attack: kinds[next++]! };
    return next >= kinds.length && step > 5 ? then(step, me, wielder) : {};
  };
}

/** Steps from the second attack's start to its blade going live. */
function secondStartup(first: AttackKind, second: AttackKind): number {
  const { starts, live } = play(chainOf([first, second]), 120, newFight(FAR));
  assert.equal(starts.length, 2, `${first} -> ${second} chained`);
  return live[1]! - starts[1]!;
}

const momentumOf = (fight: Fight) => fight.world.require(fight.players[0]!, Wielder).momentum;

describe("the next swing's start depends on the last one", () => {
  test("pressed early, the next swing starts on the step the last one lets go (the chain point)", () => {
    const { starts } = play(chainOf(["lr", "tb"]), 120, newFight(FAR));
    // The fight sums its clock one step at a time, so it counts steps the same way.
    let t = 0, n = 0;
    for (; t < startupTime("opening", 0, WEAPONS.sword.speed) + CHAIN.activeTime; n++) t += FIXED_DT;
    assert.equal(starts[1]! - starts[0]!, n);
  });

  test("an opening swing (no chain) takes the opening time to go live", () => {
    const { starts, live } = play(chainOf(["lr"]), 120, newFight(FAR));
    assert.equal(live[0]! - starts[0]!, steps(CHAIN.startupTime.opening));
  });

  test("a reverse on the same line starts fastest, a perpendicular one slowest, others in between", () => {
    for (const [first, reverse, other, perpendicular] of [
      ["lr", "rl", "tlbr", "tb"], ["tb", "bt", "trbl", "lr"],
      ["tlbr", "brtl", "lr", "trbl"], ["bltr", "trbl", "tb", "brtl"],
    ] as const) {
      const r = secondStartup(first, reverse), o = secondStartup(first, other), p = secondStartup(first, perpendicular);
      assert.ok(r < o && o < p, `${first}: reverse ${r}, other ${o}, perpendicular ${p} steps`);
    }
  });
});

describe("momentum", () => {
  /** The most momentum a chain of `kinds` built. */
  const after = (kinds: AttackKind[]) =>
    Math.max(...play(chainOf(kinds), 5 + kinds.length * 30, newFight(FAR)).momentum);

  test("grows with every chained swing, more for a reverse than for anything else", () => {
    assert.equal(after(["lr"]), 0, "one swing is no chain");
    assert.ok(after(["lr", "rl"]) > after(["lr", "tlbr"]), "reverse > other");
    assert.ok(after(["lr", "tlbr"]) > after(["lr", "tb"]), "other > perpendicular");
    assert.ok(after(["lr", "tb"]) > 0, "a perpendicular chain still builds some");
    assert.ok(after(["lr", "rl", "lr"]) > after(["lr", "rl"]), "and more with each");
  });

  test("raises each hit's damage, up to the cap", () => {
    const kinds: AttackKind[] = ["lr", "rl", "lr", "rl", "lr", "rl", "lr", "rl", "lr", "rl"];
    const { damage } = play(chainOf(kinds), 400, newFight(NEAR, { ...STATUE, maxHp: 10000 }));
    assert.equal(damage.length, kinds.length);
    assert.equal(damage[0], BASE_DAMAGE);
    assert.ok(damage[1]! > damage[0]!, "the second hit is stronger");
    for (let i = 1; i < damage.length; i++) assert.ok(damage[i]! >= damage[i - 1]!, `hit ${i + 1} no weaker`);
    assert.equal(damage.at(-1), BASE_DAMAGE * MOMENTUM.maxDamage, "capped");
  });

  test("resets when the chain breaks: a gap, a block, a dodge", () => {
    const kinds: AttackKind[] = ["lr", "rl", "lr"];
    const built = play(chainOf(kinds), 5 + 2 * steps(SLOWEST_SWING) + 3, newFight(FAR));
    assert.ok(momentumOf(built.fight) > 0, "a chain is going");

    const gap = play(chainOf(kinds), 5 + kinds.length * 30 + 30, newFight(FAR));
    assert.equal(momentumOf(gap.fight), 0, "after a gap");

    for (const breaker of [{ block: true }, { dodge: true, moveX: 1 }]) {
      // Pressed as the last swing ends: the chain is still alive then.
      const script = chainOf(kinds, (_step, me) => (me.action === "none" ? breaker : {}));
      const broken = play(script, 5 + 3 * steps(SLOWEST_SWING) + 20, newFight(FAR));
      assert.ok(broken.momentum.some((m) => m > 0), "a chain was going");
      assert.equal(momentumOf(broken.fight), 0, JSON.stringify(breaker));
    }
  });

  test("resets when a hit is taken", () => {
    // A biter in front bites mid-chain.
    const late: EnemyDef = { ...BITER, maxHp: 1e6, poise: 1e6, attacks: { lunge: { ...BITER.attacks.lunge!, firstDelay: 0.8 } } };
    const kinds: AttackKind[] = Array.from({ length: 12 }, (_, i) => (i % 2 ? "rl" : "lr"));
    const bitten = play(chainOf(kinds), 160, newFight(2.4, late));
    const at = bitten.hurt[0]!;
    assert.ok(at !== undefined, "bitten");
    assert.ok(bitten.momentum[at - 2]! > 0, "a chain was going");
    assert.equal(bitten.momentum[at - 1], 0, "gone with the bite");
  });

  test("a stab after a chain is its finisher: it spends the momentum on its damage", () => {
    const opening = play(chainOf(["stab"]), 80).damage[0]!;
    assert.equal(opening, physicalDamage(WEAPONS.sword.damage * PLAYER.stab.damageFactor, STATS));
    const finisher = play(chainOf(["lr", "rl", "lr", "stab"]), 200);
    const momentumBefore = finisher.momentum[finisher.starts.at(-1)! - 2]!;
    assert.ok(momentumBefore > 0);
    assert.equal(finisher.damage.length, 4);
    assert.equal(finisher.damage.at(-1), opening * (1 + momentumBefore * MOMENTUM.stabBonusPerPoint));
    assert.equal(finisher.momentum.at(-1), 0, "spent");
  });
});
