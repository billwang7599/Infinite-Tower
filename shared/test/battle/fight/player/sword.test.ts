import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  FIXED_DT, AVERAGE_STAT, CHAIN, damageTotal, DAMAGE_TYPES, emptyBag, feltHeft, packFor, HYBRID, lastFeintStep,
  MOMENTUM, momentumDamage, Player, Stamina, STAT_POWERS, strikeCost, strikeDamage, toSteps,
  TWO_HAND_STRENGTH_FACTOR, wayStepsAfter, WEAPONS, Wielder, windupTime, type ChainKind, type Hand, type ItemId,
  type PlayerInputData, type Strike, type SwingDir, type Weapon,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ARENA, enemy, input, player, STATS, STATUE, armed } from "../fixtures.js";

before(() => initPhysics());

const SWORD = WEAPONS.sword;
const NEAR = 2;
const dealt = (strike: Strike, power = 1) => damageTotal(strikeDamage(SWORD, strike, power, STATS));

const newFight = (at = NEAR) => new Fight({
  arena: { ...ARENA, radius: 40 },
  players: [
    player({ x: 0, y: 0.05, z: 0 }, { vitals: { hp: 100, stamina: 1000 }, stats: { ...STATS, stamina: 1000 } }),
  ],
  enemies: [enemy({ ...STATUE, maxHp: 100_000 }, { x: 0, y: 0.05, z: at })],
});

interface Played {
  fight: Fight; starts: number[]; lives: number[]; hands: Hand[]; damage: number[]; events: FightEvent[];
}

type Press = [Strike, SwingDir] | [Strike, SwingDir, "swap"];

function chain(fight: Fight, presses: Press[], to = 150,
  then: (step: number) => Partial<PlayerInputData> = () => ({})): Played {
  const me = fight.players[0]!, wielder = fight.world.require(me, Wielder);
  const out: Played = { fight, starts: [], lives: [], hands: [], damage: [], events: [] };
  let next = 0, pressAt = 2;
  while (fight.steps < to) {
    const step = fight.steps + 1, press = presses[next];
    const now = step === pressAt && press ? press : null;
    const way = (presses[out.starts.length] ?? presses.at(-1))?.[1] ?? "tb";
    fight.step([input({
      locked: 0, way, attack: now?.[0] ?? null, switchHand: now?.[2] === "swap",
      ...(next >= presses.length ? then(step) : {}),
    })]);
    if (now) next++;
    const swing = wielder.swing;
    if (swing && swing.step === 1) {
      out.starts.push(step);
      out.lives.push(swing.liveAt);
      out.hands.push(wielder.hands.active);
      pressAt = step + 2;
    }
    for (const ev of fight.events) {
      out.events.push(ev);
      if (ev.type === "hit" && ev.team === "enemy") out.damage.push(ev.damage);
    }
  }
  return out;
}

const chainOf = (fight: Fight, hand?: Hand) => {
  const wielder = fight.world.require(fight.players[0]!, Wielder);
  return wielder.chains[hand ?? wielder.hands.active];
};
const momentumOf = (fight: Fight, hand?: Hand) => chainOf(fight, hand).momentum;
const steps = (kind: ChainKind, weapon: Weapon = SWORD) =>
  wayStepsAfter(weapon, CHAIN.startupTime[kind], false, AVERAGE_STAT);

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
    const opening = steps("opening"), reverse = steps("reverse");
    // Each chained light starts as the last one's recovery is over.
    const landed = opening.endAt + reverse.endAt + reverse.liveUntil + 2;
    const p = chain(newFight(), [["light", "lr"], ["light", "rl"], ["light", "lr"]], landed);
    assert.equal(momentumOf(p.fight), 2 * MOMENTUM.gain.reverse);
    assert.equal(p.damage.length, 3);
    assert.equal(p.damage[0], dealt("light"));
    assert.equal(p.damage[2], dealt("light", momentumDamage(2 * MOMENTUM.gain.reverse)));
    chain(p.fight, [], landed + reverse.endAt - reverse.liveUntil + toSteps(CHAIN.gapTime) + 2);
    assert.equal(momentumOf(p.fight), 0);
  });

  test("momentum adds damage, never speed: every chained swing of a kind winds up the same", () => {
    const p = chain(newFight(), [["light", "lr"], ["light", "tlbr"], ["light", "lr"], ["light", "tlbr"]], 250);
    assert.equal(p.damage.length, 4);
    assert.ok(p.damage[3]! > p.damage[1]!);
    assert.deepEqual(p.lives.slice(1), [1, 2, 3].map(() => steps("other").liveAt));
  });

  test("a hand can't swing again until its recovery is over", () => {
    const p = chain(newFight(), [["light", "tb"], ["light", "tb"]], 120);
    assert.equal(p.starts.length, 2);
    assert.equal(p.starts[1]! - p.starts[0]!, steps("opening").endAt);
  });

  test("a stab spends the momentum for more damage", () => {
    const fresh = chain(newFight(), [["stab", "lr"]], 40).damage[0]!;
    const spent = chain(newFight(), [["light", "lr"], ["light", "rl"], ["light", "lr"], ["stab", "lr"]], 200);
    assert.equal(fresh, dealt("stab"));
    assert.ok(spent.damage[3]! > fresh);
    assert.equal(momentumOf(spent.fight), 0);
  });

  test("a dodge or a block breaks the chain", () => {
    for (const then of [{ dodge: true }, { block: true }]) {
      const p = chain(newFight(), [["light", "lr"], ["light", "rl"]], 120, () => then);
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
          gear: {
            bag: emptyBag(), pack: packFor(null), quiver: packFor(null),
            equipment: { ...armed(), rightHand: "greatsword" },
          },
        })],
        enemies: [enemy({ ...STATUE, maxHp: 100_000 }, { x: 0, y: 0.05, z: 30 })],
      });
      const me = fight.players[0]!, stamina = fight.world.require(me, Stamina), before = stamina.value;
      fight.step([input({ locked: 0, way: "tb", attack: "light" })]);
      return { spent: before - stamina.value, liveAt: fight.world.require(me, Wielder).swing!.liveAt };
    };
    const strong = swingAs(AVERAGE_STAT * 2), average = swingAs(AVERAGE_STAT);
    for (const [spent, strength] of [[strong.spent, AVERAGE_STAT * 2], [average.spent, AVERAGE_STAT]] as const) {
      assert.ok(Math.abs(spent - strikeCost(WEAPONS.greatsword, "light", strength)) < 1e-9, `${strength}`);
    }
    assert.ok(strong.liveAt < average.liveAt);
  });
});

describe("a lone blade is held in both hands, its strength counting TWO_HAND_STRENGTH_FACTOR times", () => {
  function swingWith(rightHand: ItemId, leftHand: ItemId | null, strike: Strike = "light") {
    const fight = new Fight({
      arena: { ...ARENA, radius: 40 },
      players: [player({ x: 0, y: 0.05, z: 0 }, {
        vitals: { hp: 100, stamina: 1000 }, stats: { ...STATS, stamina: 1000 },
        gear: {
          bag: emptyBag(), pack: packFor(null), quiver: packFor(null), equipment: { ...armed(), rightHand, leftHand },
        },
      })],
      enemies: [enemy({ ...STATUE, maxHp: 100_000 }, { x: 0, y: 0.05, z: NEAR })],
    });
    const me = fight.players[0]!, stamina = fight.world.require(me, Stamina), before = stamina.value;
    fight.step([input({ locked: 0, way: "tb", attack: strike })]);
    const spent = before - stamina.value, swing = fight.world.require(me, Wielder).swing!;
    return { spent, liveAt: swing.liveAt, endAt: swing.endAt, damage: swing.damage };
  }

  test("every melee blade, the Basic Sword and the Old Stick too, swings and costs as at the grip's strength", () => {
    const gripped = STATS.strength * TWO_HAND_STRENGTH_FACTOR;
    for (const item of ["old-stick", "sword", "longsword", "greatsword"] as const) {
      for (const strike of ["light", "heavy", "stab"] as const) {
        const weapon = WEAPONS[item], what = `${item} ${strike}`;
        const one = swingWith(item, "skillbook", strike), two = swingWith(item, null, strike);
        const steps = (strength: number) =>
          wayStepsAfter(weapon, windupTime(strike, "opening"), strike === "heavy", strength);
        assert.deepEqual([two.liveAt, two.endAt], [steps(gripped).liveAt, steps(gripped).endAt], what);
        assert.deepEqual([one.liveAt, one.endAt], [steps(STATS.strength).liveAt, steps(STATS.strength).endAt], what);
        assert.ok(two.liveAt <= one.liveAt && two.endAt <= one.endAt && two.spent < one.spent, what);
        assert.ok(Math.abs(two.spent - strikeCost(weapon, strike, gripped)) < 1e-9, `${what}: ${two.spent}`);
        assert.ok(Math.abs(one.spent - strikeCost(weapon, strike, STATS.strength)) < 1e-9, `${what}: ${one.spent}`);
      }
    }
  });

  test("the Basic Sword feels as at the grip's strength, and hits each type harder by the grip's strength", () => {
    assert.ok(feltHeft(SWORD, STATS.strength * TWO_HAND_STRENGTH_FACTOR) < feltHeft(SWORD, STATS.strength));
    for (const strike of ["light", "heavy", "stab"] as const) {
      const one = swingWith("sword", "skillbook", strike), two = swingWith("sword", null, strike);
      assert.deepEqual(one.damage, strikeDamage(SWORD, strike, 1, STATS), strike);
      for (const type of DAMAGE_TYPES) {
        const want = one.damage[type] * TWO_HAND_STRENGTH_FACTOR ** STAT_POWERS.damage;
        assert.ok(Math.abs(two.damage[type] - want) < 1e-9, `${strike} ${type}: ${two.damage[type]} vs ${want}`);
      }
    }
  });

  test("anything in the other hand, a second blade too, keeps it one-handed", () => {
    const book = swingWith("greatsword", "skillbook"), blade = swingWith("greatsword", "sword");
    assert.equal(blade.liveAt, book.liveAt);
    assert.deepEqual(blade.damage, book.damage);
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
    const holdCost = HYBRID.block.holdStaminaPerSec * FIXED_DT;
    assert.ok(Math.abs(fight.world.require(me, Stamina).value - (stamina - HYBRID.feint.cost - holdCost)) < 1e-9);
    assert.ok(fight.events.some((e) => e.type === "feint" && e.by === me));
  });

  test("leaves the blade recovering, by its felt heft: the guard held, no swing until it's over", () => {
    const { fight, me, wielder } = blockAt("heavy", () => 1), feintAt = fight.steps;
    const recover = toSteps(HYBRID.feint.recoverTime * feltHeft(SWORD, AVERAGE_STAT));
    let press: Strike = "light";
    while (wielder.swing === null && fight.steps < feintAt + 3 * recover) {
      assert.equal(fight.world.require(me, Player).action, "block");
      press = press === "light" ? "heavy" : "light";
      fight.step([input({ locked: 0, way: "lr", block: true, attack: press })]);
    }
    assert.equal(fight.steps - feintAt, recover);
  });

  test("opens no perfect block and ends the chain", () => {
    const fight = newFight(30), me = fight.players[0]!, wielder = fight.world.require(me, Wielder);
    fight.step([input({ locked: 0, way: "lr", attack: "light" })]);
    fight.step([input({ locked: 0, way: "rl" })]);
    fight.step([input({ locked: 0, way: "rl", attack: "heavy" })]);
    while (wielder.swing?.attack !== "heavy") fight.step([input({ locked: 0, way: "rl" })]);
    assert.ok(momentumOf(fight) > 0);
    fight.step([input({ locked: 0, way: "rl", block: true })]);
    assert.equal(wielder.swing, null);
    assert.equal(fight.world.require(me, Player).perfectBlockLeft, 0);
    assert.equal(momentumOf(fight), 0);
    assert.equal(chainOf(fight).combo, null);
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

describe("two blades: the switch-hand key picks the one that swings", () => {
  const holding = (rightHand: ItemId | null, leftHand: ItemId | null) => new Fight({
    arena: { ...ARENA, radius: 40 },
    players: [player({ x: 0, y: 0.05, z: 0 }, {
      gear: { bag: emptyBag(), pack: packFor(null), quiver: packFor(null), equipment: { ...armed(), rightHand,
      leftHand } },
    })],
    enemies: [enemy({ ...STATUE, maxHp: 100_000 }, { x: 0, y: 0.05, z: NEAR })],
  });
  const wielderOf = (fight: Fight) => fight.world.require(fight.players[0]!, Wielder);
  const tap = (fight: Fight, over: Partial<PlayerInputData> = {}) => {
    fight.step([input({ locked: 0, switchHand: true, ...over })]);
    fight.step([input({ locked: 0 })]);
  };
  const lightDamage = (fight: Fight) => {
    fight.step([input({ locked: 0, way: "lr", attack: "light" })]);
    return wielderOf(fight).swing?.damage ?? null;
  };
  const lightOf = (weapon: Weapon) => strikeDamage(weapon, "light", 1, STATS);

  test("the right hand swings first; a tap of the key swings the left's blade, another the right's", () => {
    const fight = holding("sword", "longsword");
    assert.equal(wielderOf(fight).hands.active, "rightHand");
    tap(fight);
    assert.equal(wielderOf(fight).hands.active, "leftHand");
    assert.deepEqual(lightDamage(fight), lightOf(WEAPONS.longsword));
    const back = holding("sword", "longsword");
    tap(back);
    tap(back);
    assert.deepEqual(lightDamage(back), lightOf(SWORD));
  });

  test("does nothing without a blade in each hand", () => {
    for (const [right, left] of [["sword", "skillbook"], ["sword", "wooden-shield"], [null, "sword"]] as const) {
      const fight = holding(right, left);
      tap(fight);
      assert.equal(wielderOf(fight).hands.active, "rightHand", `${right} ${left}`);
    }
  });

  test("pressed mid-swing, it switches once that blade is done, not before", () => {
    const fight = holding("sword", "kobold-blade");
    fight.step([input({ locked: 0, way: "lr", attack: "light" })]);
    const swing = wielderOf(fight).swing!;
    tap(fight);
    assert.equal(wielderOf(fight).hands.active, "rightHand");
    assert.equal(wielderOf(fight).swing, swing);
    while (wielderOf(fight).swing && wielderOf(fight).swing!.step < swing.liveUntil) {
      fight.step([input({ locked: 0 })]);
    }
    fight.step([input({ locked: 0 })]);
    assert.equal(wielderOf(fight).hands.active, "leftHand");
  });

  test("with a shield in one hand, the other hand's blade swings", () => {
    const fight = holding("wooden-shield", "sword");
    assert.deepEqual(lightDamage(fight), lightOf(SWORD));
  });

  test("the other hand swings while the first recovers", () => {
    const p = chain(holding("sword", "sword"), [["light", "lr"], ["light", "lr", "swap"]], 120);
    assert.deepEqual(p.hands, ["rightHand", "leftHand"]);
    assert.equal(p.starts[1]! - p.starts[0]!, steps("opening").liveUntil);
  });

  test("a swap never cuts a hand's recovery short", () => {
    const fight = holding("greatsword", "greatsword"), wielder = wielderOf(fight);
    fight.step([input({ locked: 0, way: "lr", attack: "heavy" })]);
    const swing = wielder.swing!, start = fight.steps;
    while (wielder.swing === swing && swing.step < swing.liveUntil) fight.step([input({ locked: 0 })]);
    tap(fight);
    tap(fight);
    assert.equal(wielder.hands.active, "rightHand");
    let again: number | null = null;
    for (let i = 0; i < 120 && again === null; i++) {
      fight.step([input({ locked: 0, way: "lr", attack: i % 2 === 0 ? "light" : null })]);
      if (wielder.swing !== swing && wielder.swing?.step === 1) again = fight.steps;
    }
    assert.equal(again! - start, swing.endAt);
  });

  test("each hand keeps its own chain and momentum", () => {
    const landed = 2 + 2 * steps("opening").liveUntil + steps("reverse").liveUntil + 2;
    const p = chain(holding("sword", "sword"), [["light", "lr"], ["light", "rl", "swap"], ["light", "rl", "swap"]],
      landed);
    assert.deepEqual(p.hands, ["rightHand", "leftHand", "rightHand"]);
    assert.deepEqual(p.lives, [steps("opening").liveAt, steps("opening").liveAt, steps("reverse").liveAt]);
    assert.equal(momentumOf(p.fight, "rightHand"), MOMENTUM.gain.reverse);
    assert.equal(momentumOf(p.fight, "leftHand"), MOMENTUM.gain.opening);
    assert.equal(chainOf(p.fight, "leftHand").combo, "rl");
  });

  test("a feint's recovery holds back only the hand that swung", () => {
    const fight = holding("sword", "sword"), wielder = wielderOf(fight);
    fight.step([input({ locked: 0, way: "lr", attack: "heavy" })]);
    fight.step([input({ locked: 0, way: "lr", block: true })]);
    assert.equal(wielder.swing, null);
    assert.ok(wielder.chains.rightHand.recoverSteps > 0);
    tap(fight);
    fight.step([input({ locked: 0, way: "lr", attack: "light" })]);
    assert.equal(wielderOf(fight).swing?.hand, "leftHand");
    assert.ok(wielder.chains.rightHand.recoverSteps > 0);
  });
});
