import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  CHAIN, emptyBag, Enemy, feltHeft, FIXED_DT, guardRaiseTime, Health, HYBRID, WEAPONS, lastFeintStep, packFor,
  isSwing, parryWay, Player, Stamina, strikeOf, toSteps, WeaponAttack, Wielder, wayStepsAfter, windupTime,
  type EnemyDef, type Entity, type PlayerInputData, type Strike, type SwingDir, type Way, type WeaponAttackDef,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import {
  ARENA, armed, enemy, FULL_HP, FULL_STAMINA, input, player, STATS, STATUE, swings, SWORDSMAN, SWORDSMAN_STRENGTH,
} from "../fixtures.js";

before(() => initPhysics());

const kobold = (over: Partial<WeaponAttackDef> = {}): EnemyDef => ({
  ...SWORDSMAN, maxHp: 10_000, attacks: { weapon: swings({ minChain: 2, maxChain: 2, cooldown: 1, ...over }) },
});

function play(
  def: EnemyDef, steps: number, script: (s: number) => Partial<PlayerInputData> = () => ({}), at = 2,
) {
  const fight = new Fight({
    arena: ARENA, players: [player({ x: 0, y: 0.05, z: 0 })],
    enemies: [enemy(def, { x: 0, y: 0.05, z: at })],
  });
  const events: FightEvent[] = [];
  for (let i = 0; i < steps; i++) {
    fight.step([input({ locked: 0, ...script(fight.steps + 1) })]);
    events.push(...fight.events);
  }
  return { fight, events, me: fight.players[0]!, it: fight.enemies[0]! };
}

describe("a swordsman", () => {
  test("chains swings of any way or a stab", () => {
    const { fight, it } = play(kobold(), 0);
    const ways = new Set<string>();
    while (fight.steps < 1200) {
      fight.step([input({})]);
      const swing = fight.world.require(it, Wielder).swing;
      if (swing?.way && swing.step === 1) ways.add(swing.way);
    }
    assert.ok(ways.size >= 4, [...ways].join());
  });

  test("holds a block walking up: a blocked hit costs it poise, a heavy more, and out of poise it staggers", () => {
    const light = play(kobold({ firstDelay: 99 }), 60, (s) => ({ attack: s === 20 ? "light" : null }));
    assert.ok(light.events.some((e) => e.type === "block" && e.target === light.it && !e.broken));
    assert.equal(light.fight.world.require(light.it, Enemy).state, "approach");
    const def = { ...kobold({ firstDelay: 99 }), poise: HYBRID.heavy.poiseDamage };
    const heavy = play(def, 90, (s) => ({ attack: s === 20 ? "heavy" : null }));
    assert.ok(heavy.events.some((e) => e.type === "block" && e.target === heavy.it && e.broken));
    assert.equal(heavy.fight.world.require(heavy.it, Enemy).state, "staggered");
  });

  test("perfect-blocks a player's swing it reads: the player loses stamina and recoils, and it counters later", () => {
    const def = kobold({ perfectBlockChance: 1, firstDelay: 1.5 });
    const { fight, me, it } = play(def, 0);
    const wielder = fight.world.require(it, Wielder);
    let blocked = -1, recoil = 0;
    while (fight.steps < 300 && wielder.swing?.step !== 1) {
      fight.step([input({ locked: 0, attack: fight.steps + 1 === 20 ? "light" : null })]);
      if (!fight.events.some((e) => e.type === "block" && e.perfect && e.by === me && e.target === it)) continue;
      blocked = fight.steps;
      recoil = fight.world.require(me, Health).hitstun;
      assert.equal(fight.world.require(me, Player).action, "stagger");
      assert.ok(fight.world.require(me, Stamina).value <= FULL_STAMINA - HYBRID.block.perfectDrain);
    }
    assert.ok(blocked > 0, "blocked perfectly");
    assert.equal(recoil, HYBRID.counter.recoilTime);
    assert.ok(fight.steps >= toSteps(def.attacks.weapon!.firstDelay), `countered at ${fight.steps}, in its cooldown`);
    const swing = wielder.swing!, strike = strikeOf(swing.attack, swing.way);
    const opening = wayStepsAfter(WEAPONS.sword, windupTime(strike, "opening"), strike === "heavy", SWORDSMAN_STRENGTH);
    assert.equal(swing.liveAt, opening.liveAt, "wound up as a player's opening");
  });

  test("its blows land on a player who doesn't defend, and a held block stops them", () => {
    const open = play(kobold({ firstDelay: 0 }), 200);
    assert.ok(open.fight.world.require(open.me, Health).hp < FULL_HP);
    const held = play(kobold({ firstDelay: 0 }), 200, () => ({ block: true }));
    assert.ok(held.events.some((e) => e.type === "block" && e.target === held.me));
    assert.ok(!held.events.some((e) => e.type === "hit" && e.target === held.me));
    assert.ok(HYBRID.block.chipFraction > 0 && held.fight.world.require(held.me, Health).hp < FULL_HP, "chipped");
  });

  test("feints its def's share of heavies: pulled back at the last moment into its guard, the chain over", () => {
    const { fight, it } = play(kobold({ heavyShare: 1, heavyFeintShare: 1, blockReactTime: 0.3 }), 0);
    const wielder = fight.world.require(it, Wielder), enemy = fight.world.require(it, Enemy);
    let feints = 0, heavies = 0;
    while (fight.steps < 900) {
      const before = wielder.swing ? { ...wielder.swing } : null;
      fight.step([input({ locked: 0 })]);
      if (wielder.swing?.step === 1 && wielder.swing.attack === "heavy") heavies++;
      if (!fight.events.some((e) => e.type === "feint" && e.by === it)) continue;
      feints++;
      assert.equal(before?.attack, "heavy");
      assert.equal(before!.step, lastFeintStep(before!.liveAt));
      assert.equal(wielder.swing, null);
      assert.equal(enemy.state, "approach");
      assert.ok(enemy.stateTime >= 0.3, "guarding at once");
      assert.equal(fight.world.require(it, WeaponAttack).swingsLeft, 0);
    }
    assert.ok(feints > 0 && feints >= heavies - 1, `${feints} of ${heavies}`);
  });

  test("a feint leaves its blade recovering, by its felt heft: no parry until it's over, as a player's", () => {
    const recover = toSteps(HYBRID.feint.recoverTime * feltHeft(WEAPONS.sword, SWORDSMAN_STRENGTH));
    const parriedAfter = (wait: number) => {
      const { fight, it } = play(kobold({ heavyShare: 1, heavyFeintShare: 1, parryChance: 1 }), 0);
      while (!fight.events.some((e) => e.type === "feint" && e.by === it)) fight.step([input({ locked: 0 })]);
      const feintAt = fight.steps;
      let parried = false;
      while (fight.steps < feintAt + wait + 30) {
        const s = fight.steps + 1;
        fight.step([input({ locked: 0, way: "lr", attack: s === feintAt + wait ? "light" : null })]);
        parried ||= fight.events.some((e) => e.type === "parry" && e.by === it);
      }
      return parried;
    };
    assert.equal(parriedAfter(1), false, "pressed at once");
    assert.equal(parriedAfter(recover), true, "pressed once it's over");
  });

  test("feints only some heavies, by the fight's seed, and never with no share", () => {
    const count = (share: number) => {
      const { events, it } = play(kobold({ heavyShare: 1, heavyFeintShare: share, cooldown: 0.2 }), 1500);
      return events.filter((e) => e.type === "feint" && e.by === it).length;
    };
    assert.equal(count(0), 0);
    const some = count(0.5);
    assert.ok(some > 0, `${some}`);
    assert.equal(count(0.5), some);
  });

  test("raises its guard in its blade's time once it reacts: a hit landing before that isn't blocked", () => {
    const swing = (s: number) => ({ attack: s === 20 ? "light" as const : null });
    const holding = (blade: "sword" | "greatsword", blockReactTime: number) => {
      const def = kobold({ firstDelay: 99, blockReactTime });
      return play({ ...def, wielder: { ...def.wielder!, hands: { rightHand: blade } } }, 60, swing);
    };
    const blocks = (r: ReturnType<typeof play>) => r.events.some((e) => e.type === "block" && e.target === r.it);
    const lands = (r: ReturnType<typeof play>) => r.events.some((e) => e.type === "hit" && e.target === r.it);
    const reactedFor = play(kobold({ firstDelay: 99, blockReactTime: 99 }), 0);
    let at = 0;
    while (!reactedFor.events.some((e) => e.type === "hit")) {
      reactedFor.fight.step([input({ locked: 0, ...swing(reactedFor.fight.steps + 1) })]);
      reactedFor.events.push(...reactedFor.fight.events);
      at = reactedFor.fight.world.require(reactedFor.it, Enemy).stateTime;
    }
    const raise = (blade: "sword" | "greatsword") => guardRaiseTime(WEAPONS[blade], SWORDSMAN_STRENGTH);
    assert.ok(lands(holding("sword", at - raise("sword") + 2 * FIXED_DT)), "rising");
    assert.ok(blocks(holding("sword", at - raise("sword") - 2 * FIXED_DT)), "up");
    assert.ok(lands(holding("greatsword", at - raise("sword") - 2 * FIXED_DT)), "a greatsword's still rising");
    assert.ok(blocks(holding("greatsword", at - raise("greatsword") - 2 * FIXED_DT)), "a greatsword's up");
  });
});

describe("a swordsman swings as a player does", () => {
  type Blade = "sword" | "greatsword";
  interface Swung { strike: Strike; way: Way; start: number; steps: number[] }

  function record(fight: Fight, e: Entity, count: number, next: (out: Swung[]) => Partial<PlayerInputData>) {
    const wielder = fight.world.require(e, Wielder), out: Swung[] = [];
    let end = -1;
    while (fight.steps < 900 && end < 0) {
      fight.step([input(next(out))]);
      const s = wielder.swing;
      if (s?.step === 1 && out.length < count) {
        out.push({ strike: strikeOf(s.attack, s.way), way: s.way, start: fight.steps,
          steps: [s.driveAt, s.liveAt, s.liveUntil, s.endAt] });
      } else if (out.length === count && s === null) end = fight.steps;
    }
    return out.map(({ start, ...rest }, i) => ({ ...rest, gap: (out[i + 1]?.start ?? end) - start }));
  }

  function enemyChain(blade: Blade) {
    const def = kobold({ minChain: 3, maxChain: 3, heavyShare: 0.5, triggerDist: 15, firstDelay: 0 });
    const fight = new Fight({
      arena: ARENA, players: [player({ x: 0, y: 0.05, z: -7 })],
      enemies: [enemy({ ...def, wielder: { ...def.wielder!, hands: { rightHand: blade } } }, { x: 0, y: 0.05, z: 7 })],
    });
    return record(fight, fight.enemies[0]!, 3, () => ({}));
  }

  function playerChain(blade: Blade, swings: { strike: Strike; way: Way }[]) {
    const equipment = { ...armed(), rightHand: blade, leftHand: null };
    const fight = new Fight({
      arena: ARENA, players: [player({ x: 0, y: 0.05, z: 0 }, {
        gear: { bag: emptyBag(), pack: packFor(null), quiver: packFor(null), equipment },
      })],
      enemies: [enemy(STATUE, { x: 0, y: 0.05, z: 7 })],
    });
    let pressAt = 10, seen = 0;
    return record(fight, fight.players[0]!, swings.length, (out) => {
      if (out.length > seen) [seen, pressAt] = [out.length, out.at(-1)!.start + 2];
      const want = swings[out.length], s = fight.steps + 1;
      const way = want && isSwing(want.way) ? want.way : null;
      return { aimX: 0, aimZ: -1, way, attack: want && s === pressAt ? want.strike : null };
    });
  }

  test("with the same blade, grip and strength, its chain winds up, swings and recovers in a player's steps", () => {
    for (const blade of ["sword", "greatsword"] as const) {
      const its = enemyChain(blade);
      assert.equal(its.length, 3, blade);
      assert.deepEqual(playerChain(blade, its), its, blade);
    }
  });

  test("its first swing winds up a player's opening, through the felt heft of its blade at its grip's strength", () => {
    const first = enemyChain("greatsword")[0]!, heavy = first.strike === "heavy";
    const opening = wayStepsAfter(WEAPONS.greatsword, windupTime(first.strike, "opening"), heavy, SWORDSMAN_STRENGTH);
    assert.deepEqual(first.steps, [opening.driveAt, opening.liveAt, opening.liveUntil, opening.endAt]);
  });
});

describe("a swordsman stunned mid-chain", () => {
  const def = kobold({ minChain: 3, maxChain: 3, cooldown: 1 }), attackDef = def.attacks.weapon!;
  const blade = WEAPONS[def.wielder!.hands.rightHand as keyof typeof WEAPONS];

  function swingsAfterStun(
    stun: (fight: Fight, it: Entity) => void, script: (fight: Fight, it: Entity) => Partial<PlayerInputData>,
  ) {
    const { fight, it } = play(def, 0);
    const enemy = fight.world.require(it, Enemy), wielder = fight.world.require(it, Wielder);
    const until = (done: () => boolean) => {
      for (let i = 0; i < 1200 && !done(); i++) fight.step([input({ locked: 0, ...script(fight, it) })]);
      assert.ok(done(), `stuck ${enemy.state}`);
    };
    const swingStarted = () => wielder.swing?.step === 1;
    until(swingStarted);
    stun(fight, it);
    until(() => enemy.state === "staggered");
    until(() => enemy.state !== "staggered");
    const back = fight.steps;
    until(swingStarted);
    const swing = wielder.swing!, strike = strikeOf(swing.attack, swing.way);
    const opening = wayStepsAfter(blade, windupTime(strike, "opening"), strike === "heavy", SWORDSMAN_STRENGTH).liveAt;
    return { waited: fight.steps - back, liveAt: swing.liveAt, opening };
  }

  const checks = (r: { waited: number; liveAt: number; opening: number }) => {
    assert.ok(r.waited >= toSteps(attackDef.cooldown) - 1, `swung ${r.waited} steps after`);
    assert.equal(r.liveAt, r.opening, "its opening wind-up");
  };

  test("poise broken, it drops the chain and its answer, waits its whole cooldown, then winds up afresh", () => {
    checks(swingsAfterStun((fight, it) => {
      fight.world.require(it, Enemy).poise = 0;
      fight.world.require(it, WeaponAttack).riposte = true;
    }, () => ({})));
  });

  test("blocked perfectly, it recoils, waits its whole cooldown, then winds up afresh", () => {
    const blockLead = toSteps(guardRaiseTime(WEAPONS.sword, STATS.strength)) + 2;
    checks(swingsAfterStun(() => {}, (fight, it) => {
      const swing = fight.world.require(it, Wielder).swing;
      return { block: fight.world.require(it, Enemy).state === "weaponWindup" && swing !== null
        && swing.liveAt - swing.step <= blockLead };
    }));
  });

  test("once a chain's last swing has recovered, it waits its cooldown before the next chain", () => {
    const { fight, it } = play(def, 0);
    const enemy = fight.world.require(it, Enemy), wielder = fight.world.require(it, Wielder);
    const until = (done: () => boolean) => {
      for (let i = 0; i < 1200 && !done(); i++) fight.step([input({ locked: 0 })]);
      assert.ok(done(), `stuck ${enemy.state}`);
    };
    until(() => enemy.state === "weaponRecover");
    until(() => wielder.swing === null);
    const recovered = fight.steps;
    until(() => wielder.swing?.step === 1);
    assert.ok(fight.steps - recovered >= toSteps(attackDef.cooldown) - 1, `${fight.steps - recovered} steps`);
  });
});

describe("a swordsman's parries", () => {
  test("reads a player's swing by its share and parries it with the way that meets it; its counter waits", () => {
    const { events, fight, me, it } = play(kobold({ parryChance: 1, firstDelay: 99 }), 60,
      (s) => ({ way: "lr", attack: s === 20 ? "light" : null }));
    const parry = events.find((e) => e.type === "parry");
    assert.ok(parry?.type === "parry" && !parry.clash && parry.by === it && parry.target === me, JSON.stringify(parry));
    assert.ok(!events.some((e) => e.type === "hit"));
    assert.equal(fight.world.require(me, Health).hp, FULL_HP);
    assert.equal(fight.world.require(me, Player).action, "stagger");
    assert.equal(fight.world.require(it, Wielder).swing, null, "its counter waits for its cooldown");
  });

  test("lets a swing by that it could only meet by winding up under the floor", () => {
    const stick = wayStepsAfter(WEAPONS["old-stick"], CHAIN.startupTime.opening, false, STATS.strength);
    assert.ok(stick.liveAt < toSteps(CHAIN.minWindupTime) + toSteps(HYBRID.parry.clashTime));
    const equipment = { ...armed(), rightHand: "old-stick" as const };
    const fight = new Fight({
      arena: ARENA,
      players: [player({ x: 0, y: 0.05, z: 0 }, {
        gear: { bag: emptyBag(), pack: packFor(null), quiver: packFor(null), equipment },
      })],
      enemies: [enemy(kobold({ parryChance: 1, firstDelay: 99 }), { x: 0, y: 0.05, z: 2 })],
    });
    const events: FightEvent[] = [];
    for (let s = 1; s <= 45; s++) {
      fight.step([input({ locked: 0, way: "lr", attack: s === 20 ? "light" : null })]);
      events.push(...fight.events);
      assert.equal(fight.world.require(fight.enemies[0]!, Wielder).swing, null, `step ${s}`);
    }
    assert.ok(!events.some((e) => e.type === "parry"));
  });

  test("never parries with no share, and parries only some swings by the fight's seed", () => {
    const count = (chance: number) => {
      const { events, it } = play(kobold({ parryChance: chance, firstDelay: 99 }), 1200,
        (s) => ({ way: "lr", attack: s % 50 === 20 ? "light" : null }));
      return events.filter((e) => e.type === "parry" && e.by === it).length;
    };
    assert.equal(count(0), 0);
    const some = count(0.5);
    assert.ok(some > 0 && some < 24, `${some}`);
    assert.equal(count(0.5), some);
  });

  test("a player's reverse swing in time parries its swing: it recoils", () => {
    const oneHanded = { ...SWORDSMAN.wielder!, hands: { rightHand: "sword", leftHand: "skillbook" } } as const;
    const { fight, me, it } = play({ ...kobold({ firstDelay: 0, heavyShare: 1 }), wielder: oneHanded }, 0);
    const wielder = fight.world.require(it, Wielder);
    const liveIn = wayStepsAfter(WEAPONS.sword, CHAIN.startupTime.opening, false, STATS.strength).liveAt;
    let press: number | null = null, answer: SwingDir = "lr";
    const events: FightEvent[] = [];
    while (fight.steps < 600 && !events.some((e) => e.type === "parry")) {
      const s = fight.steps + 1;
      fight.step([input({ locked: 0, way: answer, attack: s === press ? "light" : null })]);
      events.push(...fight.events);
      const swing = wielder.swing;
      if (press === null && swing?.step === 1 && swing.way !== "stab") {
        answer = parryWay(swing.way);
        press = fight.steps + (swing.liveAt - 1) - 5 - liveIn + 1;
      }
    }
    const parry = events.find((e) => e.type === "parry");
    assert.ok(parry?.type === "parry" && parry.by === me && parry.target === it, JSON.stringify(parry));
    assert.equal(fight.world.require(it, Enemy).state, "staggered");
  });
});
