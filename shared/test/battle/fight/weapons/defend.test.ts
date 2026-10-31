import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  FIXED_DT, Health, HYBRID, physicalDamage, Player, Stamina, WEAPONS, Wielder, type PlayerInputData,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ARENA, FULL_HP, FULL_STAMINA, input, player, STATS } from "../fixtures.js";

// Before the describes: they run fights to find when the attacks land.
await initPhysics();

const pvp = (stamina = FULL_STAMINA) => new Fight({
  arena: ARENA, duel: true, enemies: [],
  players: [
    player({ x: 0, y: 0.05, z: 0 }),
    player({ x: 0, y: 0.05, z: 1.6 }, { vitals: { hp: FULL_HP, stamina } }),
  ],
});
const FACING_1 = { aimX: 0, aimZ: -1, locked: 0 };
type Script = (s: number) => Partial<PlayerInputData>;

function play(fight: Fight, steps: number, a: Script = () => ({}), b: Script = () => ({})): FightEvent[] {
  const events: FightEvent[] = [];
  for (let i = 0; i < steps; i++) {
    const s = fight.steps + 1;
    fight.step([input({ locked: 1, ...a(s) }), input({ ...FACING_1, ...b(s) })]);
    events.push(...fight.events);
  }
  return events;
}
const hp = (fight: Fight, i: number) => fight.world.require(fight.players[i]!, Health).hp;
const stamina = (fight: Fight, i: number) => fight.world.require(fight.players[i]!, Stamina).value;
const action = (fight: Fight, i: number) => fight.world.require(fight.players[i]!, Player).action;
const close = (a: number, b: number, what: string) => assert.ok(Math.abs(a - b) < 1e-6, `${what}: ${a} vs ${b}`);

function landsAt(at: number, strike: "light" | "heavy" | "stab" = "light"): number {
  const fight = pvp();
  const events: FightEvent[] = [];
  while (!events.some((e) => e.type === "hit")) {
    events.length = 0;
    events.push(...play(fight, 1, (s) => ({ way: "lr", attack: s === at ? strike : null })));
  }
  return fight.steps;
}
const PRESS = 40;
const SWORD = physicalDamage(WEAPONS.sword.damage, STATS);
const HOLD_STEPS = Math.round(HYBRID.block.perfectTime / FIXED_DT) + 5;
const holdFrom = (step: number): Script => (s) => ({ block: s >= step });

describe("the held block", () => {
  test("stops a weapon from in front, whatever its way, for its damage in stamina and a chip of it in HP", () => {
    for (const way of ["lr", "tb", "brtl"] as const) {
      const fight = pvp();
      const hitAt = landsAt(PRESS);
      const events = play(fight, hitAt + 2, (s) => ({ way, attack: s === PRESS ? "light" : null }),
        holdFrom(hitAt - HOLD_STEPS));
      const block = events.find((e) => e.type === "block");
      assert.ok(block && block.type === "block" && !block.broken && !block.perfect, way);
      close(FULL_HP - hp(fight, 1), SWORD * HYBRID.block.chipFraction, way);
      const held = HYBRID.block.holdStaminaPerSec * HOLD_STEPS * FIXED_DT;
      assert.ok(Math.abs(FULL_STAMINA - stamina(fight, 1) - SWORD - held) < 0.5, `${way}: ${stamina(fight, 1)}`);
      assert.equal(action(fight, 1), "block", way);
      assert.ok(!events.some((e) => e.type === "hit"), way);
      assert.equal(fight.world.require(fight.players[0]!, Wielder).swing, null, "the blade stops");
    }
  });

  test("a heavy costs twice its damage in stamina, and doesn't break a block with stamina to spare", () => {
    const hitAt = landsAt(PRESS, "heavy"), fight = pvp();
    const events = play(fight, hitAt + 2, (s) => ({ attack: s === PRESS ? "heavy" : null }),
      holdFrom(hitAt - HOLD_STEPS));
    assert.ok(events.some((e) => e.type === "block" && !e.broken));
    const heavy = SWORD * HYBRID.heavy.damageFactor, held = HYBRID.block.holdStaminaPerSec * HOLD_STEPS * FIXED_DT;
    const spent = FULL_STAMINA - stamina(fight, 1) - held;
    assert.ok(Math.abs(spent - heavy * HYBRID.block.heavyStaminaFactor) < 0.5, `${spent}`);
    assert.equal(action(fight, 1), "block");
  });

  test("running out of stamina breaks it: the blocker staggers", () => {
    const hitAt = landsAt(PRESS), fight = pvp(5);
    const events = play(fight, hitAt + 1, (s) => ({ attack: s === PRESS ? "light" : null }), () => ({ block: true }));
    assert.ok(events.some((e) => e.type === "block" && e.broken));
    assert.equal(action(fight, 1), "stagger");
    assert.equal(stamina(fight, 1), 0);
    const hitstun = fight.world.require(fight.players[1]!, Health).hitstun;
    assert.ok(Math.abs(hitstun - HYBRID.block.brokenTime) < 0.05, `${hitstun}`);
  });

  test("held, it drains stamina slowly and stamina doesn't refill", () => {
    const fight = pvp(FULL_STAMINA / 2);
    play(fight, 2, () => ({}), () => ({ block: true }));
    const before = stamina(fight, 1);
    play(fight, 60, () => ({}), () => ({ block: true }));
    const drained = before - stamina(fight, 1);
    assert.ok(Math.abs(drained - HYBRID.block.holdStaminaPerSec * 60 * FIXED_DT) < 0.2, `${drained}`);
  });

  test("doesn't cover the back", () => {
    const fight = pvp();
    const events = play(fight, 70, (s) => ({ attack: s === PRESS ? "light" : null }),
      () => ({ block: true, aimZ: 1, locked: null }));
    assert.ok(events.some((e) => e.type === "hit"));
  });
});

describe("the perfect block", () => {
  const hitAt = landsAt(PRESS);
  const perfectSteps = Math.round(HYBRID.block.perfectTime / FIXED_DT);

  test("block pressed just before a weapon lands: no chip, no stamina; the attacker loses stamina and recoils", () => {
    for (const press of [hitAt - perfectSteps + 1, hitAt]) {
      const fight = pvp();
      const events = play(fight, hitAt - fight.steps, (s) => ({ attack: s === PRESS ? "light" : null }),
        holdFrom(press));
      const block = events.find((e) => e.type === "block");
      assert.ok(block && block.type === "block" && block.perfect && block.target === fight.players[1], `${press}`);
      assert.equal(hp(fight, 1), FULL_HP);
      const held = HYBRID.block.holdStaminaPerSec * HYBRID.block.perfectTime;
      assert.ok(stamina(fight, 1) >= FULL_STAMINA - held - 1e-6, `${stamina(fight, 1)}`);
      close(stamina(fight, 0), FULL_STAMINA - HYBRID.light.cost - HYBRID.block.perfectDrain, "the attacker's");
      assert.equal(action(fight, 0), "stagger");
      const recoil = fight.world.require(fight.players[0]!, Health).hitstun;
      assert.ok(Math.abs(recoil - HYBRID.block.perfectRecoilTime) < 0.02, `${recoil}`);
    }
  });

  test("the blocker gets in first: its light lands before the attacker can act", () => {
    const fight = pvp();
    play(fight, hitAt, (s) => ({ attack: s === PRESS ? "light" : null }), holdFrom(hitAt - 2));
    const events = play(fight, 30, () => ({}), (s) => ({ attack: s === hitAt + 1 ? "light" : null }));
    assert.ok(events.some((e) => e.type === "hit" && e.target === fight.players[0]));
  });

  test("pressed too early, it's only a held block", () => {
    const fight = pvp();
    const events = play(fight, hitAt + 1, (s) => ({ attack: s === PRESS ? "light" : null }),
      holdFrom(hitAt - perfectSteps - 3));
    assert.ok(events.some((e) => e.type === "block" && !e.perfect));
  });

  test("pressed again too soon after the last press, it's only held: mashing doesn't pay", () => {
    const fight = pvp();
    const remash = Math.round(HYBRID.block.remashTime / FIXED_DT);
    const events = play(fight, hitAt + 1, (s) => ({ attack: s === PRESS ? "light" : null }),
      (s) => ({ block: s === hitAt - remash + 2 || s >= hitAt - 2 }));
    assert.ok(events.some((e) => e.type === "block" && !e.perfect));
  });

  test("a swing answered by a swing isn't parried: both land", () => {
    const fight = pvp();
    const events = play(fight, hitAt + 30, (s) => ({ way: "lr", attack: s === PRESS ? "light" : null }),
      (s) => ({ way: "lr", attack: s === PRESS - 2 ? "light" : null }));
    assert.ok(!events.some((e) => e.type === "block"));
    assert.ok(events.some((e) => e.type === "hit" && e.target === fight.players[0]));
    assert.ok(events.some((e) => e.type === "hit" && e.target === fight.players[1]));
  });
});
