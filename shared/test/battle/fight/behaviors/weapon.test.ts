import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  CHAIN, Enemy, feltHeft, FIXED_DT, guardRaiseTime, Health, HYBRID, WEAPONS, lastFeintStep, parryWay, Player, Stamina,
  toSteps, WeaponAttack, Wielder, wayStepsAfter, type EnemyDef, type Entity, type PlayerInputData, type SwingDir,
  type WeaponAttackDef,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ARENA, enemy, FULL_HP, FULL_STAMINA, input, player, STATS, swings, SWORDSMAN } from "../fixtures.js";

before(() => initPhysics());

const BASE = swings({});
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
  test("chains swings of any way or a stab, each wound up as its def says", () => {
    const { fight, it } = play(kobold(), 0);
    const ways = new Set<string>();
    let first: number | null = null;
    while (fight.steps < 1200) {
      fight.step([input({})]);
      const swing = fight.world.require(it, Wielder).swing;
      if (swing?.way && swing.step === 1) {
        ways.add(swing.way);
        first ??= swing.liveAt;
      }
    }
    assert.ok(ways.size >= 4, [...ways].join());
    assert.ok(first !== null && first >= Math.round(BASE.windup * 60));
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

  test("perfect-blocks a player's swing when it reads it: the player loses stamina, recoils, and it answers", () => {
    const { events, fight, me, it } = play(kobold({ perfectBlockChance: 1, firstDelay: 99 }), 60,
      (s) => ({ attack: s === 20 ? "light" : null }));
    assert.ok(events.some((e) => e.type === "block" && e.perfect && e.by === me && e.target === it));
    assert.equal(fight.world.require(me, Player).action, "stagger");
    assert.ok(fight.world.require(me, Stamina).value <= FULL_STAMINA - HYBRID.block.perfectDrain);
    assert.notEqual(fight.world.require(it, Wielder).swing, null);
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
    const raise = (blade: "sword" | "greatsword") => guardRaiseTime(WEAPONS[blade], STATS.strength);
    assert.ok(lands(holding("sword", at - raise("sword") + 2 * FIXED_DT)), "rising");
    assert.ok(blocks(holding("sword", at - raise("sword") - 2 * FIXED_DT)), "up");
    assert.ok(lands(holding("greatsword", at - raise("sword") - 2 * FIXED_DT)), "a greatsword's still rising");
    assert.ok(blocks(holding("greatsword", at - raise("greatsword") - 2 * FIXED_DT)), "a greatsword's up");
  });
});

describe("a swordsman stunned mid-chain", () => {
  const def = kobold({ minChain: 3, maxChain: 3, cooldown: 1 }), attackDef = def.attacks.weapon!;
  const blade = WEAPONS[def.wielder!.hands.rightHand as keyof typeof WEAPONS];
  const opening = wayStepsAfter(blade, attackDef.windup, false, STATS.strength).liveAt;

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
    return { waited: fight.steps - back, liveAt: wielder.swing!.liveAt };
  }

  const checks = (r: { waited: number; liveAt: number }) => {
    assert.ok(r.waited >= toSteps(attackDef.cooldown) - 1, `swung ${r.waited} steps after`);
    assert.equal(r.liveAt, opening, "its opening wind-up");
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

  test("recovers after a chain in its def's time × the heft its blade feels", () => {
    const { fight, it } = play(def, 0);
    const enemy = fight.world.require(it, Enemy);
    for (let i = 0; i < 1200 && enemy.state !== "weaponRecover"; i++) fight.step([input({ locked: 0 })]);
    assert.equal(enemy.duration, attackDef.recover * feltHeft(blade, STATS.strength));
    assert.ok(blade.heft > 1);
  });
});

describe("a swordsman's parries", () => {
  test("reads a player's swing by its share and parries it with the way that meets it, then answers at once", () => {
    const { events, fight, me, it } = play(kobold({ parryChance: 1, firstDelay: 99 }), 45,
      (s) => ({ way: "lr", attack: s === 20 ? "light" : null }));
    const parry = events.find((e) => e.type === "parry");
    assert.ok(parry?.type === "parry" && !parry.clash && parry.by === it && parry.target === me, JSON.stringify(parry));
    assert.ok(!events.some((e) => e.type === "hit"));
    assert.equal(fight.world.require(me, Health).hp, FULL_HP);
    assert.equal(fight.world.require(me, Player).action, "stagger");
    assert.notEqual(fight.world.require(it, Wielder).swing, null, "its answer");
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
    const { fight, me, it } = play(kobold({ firstDelay: 0 }), 0);
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
