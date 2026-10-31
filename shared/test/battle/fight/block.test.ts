import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  ATTACKS, Body, Enemy, GUARD_SIDES, Health, mirrorSide, PLAYER, Stamina, Wielder, type EnemyDef, type GuardSide,
  type PlayerInputData,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ARENA, BITER, BOAR, enemy, input, player, STATS, SWORDSMAN } from "./fixtures.js";

// Before the module's constants: they run a fight.
await initPhysics();

/** The boar's charge alone, from across the arena. */
const CHARGER: EnemyDef = { ...BOAR, walkSpeed: 0, attacks: { charge: { ...BOAR.attacks.charge!, firstDelay: 0 } } };
const SEED = 3;

interface Played { fight: Fight; events: FightEvent[] }

/** One player at the middle, aiming +z, against `def` at `enemyZ`; `script` gives the input on each step. */
function play(def: EnemyDef, enemyZ: number, seconds: number, script: (step: number) => Partial<PlayerInputData>):
  Played {
  const fight = new Fight({
    arena: { ...ARENA, radius: Math.max(ARENA.radius, 12) },
    players: [player({ x: 0, y: 0.05, z: 0 })],
    enemies: [{ ...enemy(def, { x: 0, y: 0.05, z: enemyZ }), seed: SEED }],
  });
  const events: FightEvent[] = [];
  for (let step = 1; step <= Math.round(seconds * 60); step++) {
    fight.step([input(script(step))]);
    events.push(...fight.events);
  }
  return { fight, events };
}

const me = (p: Played) => ({
  hp: p.fight.world.require(p.fight.players[0]!, Health).hp,
  stamina: p.fight.world.require(p.fight.players[0]!, Stamina).value,
  z: p.fight.world.require(p.fight.players[0]!, Body).pos.z,
});
const guarding = (guard: GuardSide) => () => ({ locked: 0, guard });

const ITS = (() => {
  const { fight } = play(SWORDSMAN, 2, 0, () => ({}));
  let side: GuardSide | null = null;
  while (!fight.events.some((e) => e.type === "hit")) {
    fight.step([input({})]);
    side ??= fight.world.require(fight.enemies[0]!, Wielder).swing?.side ?? null;
  }
  return { side: side!, landsAt: fight.steps };
})();

describe("a guard, locked on", () => {
  test("on the side the attack comes from, as the defender sees it: blocked, unhurt, for no stamina", () => {
    const p = play(SWORDSMAN, 2, 1.5, guarding(mirrorSide(ITS.side)));
    assert.equal(me(p).hp, PLAYER.maxHp);
    assert.equal(me(p).stamina, STATS.stamina);
    assert.ok(p.events.some((e) => e.type === "block" && e.target === p.fight.players[0]));
  });

  test("blocked, the attacker recoils: its attack ends, and it's busy for the attack's recoil time", () => {
    const p = play(SWORDSMAN, 2, ITS.landsAt / 60, guarding(mirrorSide(ITS.side)));
    const kobold = p.fight.world.require(p.fight.enemies[0]!, Enemy);
    assert.equal(kobold.state, "recoil");
    assert.equal(kobold.duration, ATTACKS.light.recoilTime);
    assert.equal(p.fight.world.require(p.fight.enemies[0]!, Wielder).swing, null);
  });

  test("on either other side, the attack lands", () => {
    for (const guard of GUARD_SIDES.filter((g) => g !== mirrorSide(ITS.side))) {
      assert.ok(me(play(SWORDSMAN, 2, 1.5, guarding(guard))).hp < PLAYER.maxHp, guard);
    }
  });

  test("unlocked, there's no guard: the attack lands", () => {
    const p = play(SWORDSMAN, 2, 1.5, () => ({ guard: mirrorSide(ITS.side) }));
    assert.ok(me(p).hp < PLAYER.maxHp);
  });

  test("attacking, the player isn't guarding: the attack lands", () => {
    const pressAt = ITS.landsAt - 5;
    const p = play(SWORDSMAN, 2, 1.5, (step) => ({
      ...guarding(mirrorSide(ITS.side))(), attack: step === pressAt ? "light" : null,
    }));
    assert.ok(me(p).hp < PLAYER.maxHp);
  });

  test("only in front: turned away, the attack lands", () => {
    const p = play(SWORDSMAN, 2, 1.5, () => ({ ...guarding(mirrorSide(ITS.side))(), aimX: 0, aimZ: -1 }));
    assert.ok(me(p).hp < PLAYER.maxHp);
  });
});

describe("a boar's blows come from the top", () => {
  test("a top guard stops a bite or a charge, unhurt and for no stamina, and is pushed back", () => {
    for (const [def, z, seconds] of [[BITER, 2.4, 0.7], [CHARGER, 9, 2]] as const) {
      const p = play(def, z, seconds, guarding("top"));
      const { hp, stamina, z: at } = me(p);
      assert.equal(hp, PLAYER.maxHp, def === BITER ? "bite" : "charge");
      assert.equal(stamina, STATS.stamina);
      assert.ok(at < -0.2, `pushed back to ${at.toFixed(2)}`);
    }
  });

  test("a side guard doesn't", () => {
    assert.ok(me(play(BITER, 2.4, 0.7, guarding("left"))).hp < PLAYER.maxHp);
  });
});
