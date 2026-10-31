import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Enemy, Health, HYBRID, Player, Stamina, Wielder, type EnemyDef, type PlayerInputData, type WeaponAttackDef,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ARENA, enemy, FULL_HP, FULL_STAMINA, input, player, swings, SWORDSMAN } from "../fixtures.js";

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
});
