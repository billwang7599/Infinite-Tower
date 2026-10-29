/** Blocking (held): a frontal guard that stops hits for stamina, and breaks when the stamina runs out. */
import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  ActiveHit, Body, Health, planSwing, Player, PLAYER, restingBlade, Stamina, stoppedBlade, strokeOf, WEAPONS, Wielder,
  type EnemyDef, type PlayerInputData, type SwingData,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ARENA, BITER, BOAR, enemy, input, player, STATS, swings, SWORDSMAN } from "./fixtures.js";

before(() => initPhysics());

const SWORD_DAMAGE = WEAPONS.sword.damage;
const BLOCK_COST = PLAYER.block.staminaPerMomentum;
const STAB: EnemyDef = { ...SWORDSMAN, attacks: { weapon: swings({ moves: ["stab"] }) } };
/** The boar's charge alone, from across the arena. */
const CHARGER: EnemyDef = { ...BOAR, walkSpeed: 0, attacks: { charge: { ...BOAR.attacks.charge!, firstDelay: 0 } } };

interface Played { fight: Fight; events: FightEvent[] }

/** One player at the middle, aiming +z, against `def` at `enemyZ`; `script` gives the input on each step. */
function play(def: EnemyDef, enemyZ: number, seconds: number, script: (step: number) => Partial<PlayerInputData>,
  stamina: number = STATS.stamina): Played {
  const fight = new Fight({
    arena: { ...ARENA, radius: Math.max(ARENA.radius, 12) },
    players: [player({ x: 0, y: 0.05, z: 0 }, { vitals: { hp: PLAYER.maxHp, stamina } })],
    enemies: [enemy(def, { x: 0, y: 0.05, z: enemyZ })],
  });
  const events: FightEvent[] = [];
  for (let step = 1; step <= Math.round(seconds * 60); step++) {
    fight.step([input(script(step))]);
    events.push(...fight.events);
  }
  return { fight, events };
}

const holding = () => ({ block: true });
const me = (p: Played) => ({
  hp: p.fight.world.require(p.fight.players[0]!, Health).hp,
  health: p.fight.world.require(p.fight.players[0]!, Health),
  stamina: p.fight.world.require(p.fight.players[0]!, Stamina).value,
  player: p.fight.world.require(p.fight.players[0]!, Player),
  z: p.fight.world.require(p.fight.players[0]!, Body).pos.z,
});

describe("blocking", () => {
  test("a swing in front: only a chip of its damage, some stamina, and no stagger", () => {
    const p = play(SWORDSMAN, 2, 0.9, holding);
    const { hp, stamina, player: state, health } = me(p);
    assert.equal(hp, PLAYER.maxHp - SWORD_DAMAGE * PLAYER.block.chipFraction);
    assert.equal(stamina, STATS.stamina - BLOCK_COST);
    assert.equal(state.action, "block");
    assert.equal(health.hitstun, 0);
    assert.ok(p.events.some((e) => e.type === "block"));
  });

  test("a block costs by the blow's momentum: a stronger swordsman's costs more, whatever its blade's power", () => {
    const strength = 20, momentum = planSwing(WEAPONS.sword, strength, restingBlade(), "lr").momentum;
    const strong = me(play({ ...SWORDSMAN, stats: { ...SWORDSMAN.stats, strength } }, 2, 0.9, holding));
    assert.ok(Math.abs(strong.stamina - (STATS.stamina - BLOCK_COST * momentum)) < 1e-9, `${strong.stamina}`);
    const keen = me(play({ ...SWORDSMAN, wielder: { ...SWORDSMAN.wielder!, hands: { rightHand: "kobold-blade" } } },
      2, 0.9, holding));
    assert.equal(keen.stamina, STATS.stamina - BLOCK_COST);
  });

  test("a stab in front is stopped whole", () => {
    const p = play(STAB, 2, 0.9, holding);
    assert.equal(me(p).hp, PLAYER.maxHp);
    assert.ok(me(p).stamina < STATS.stamina);
    assert.equal(me(p).player.action, "block");
  });

  test("a boar's bite or charge is stopped, for stamina, and pushes the player back", () => {
    for (const [def, z, seconds] of [[BITER, 2.4, 0.7], [CHARGER, 9, 2]] as const) {
      const p = play(def, z, seconds, holding);
      const { hp, stamina, z: at } = me(p);
      assert.equal(hp, PLAYER.maxHp, def === BITER ? "bite" : "charge");
      assert.ok(stamina < STATS.stamina, "paid in stamina");
      assert.ok(at < -0.2, `pushed back to ${at.toFixed(2)}`);
    }
  });

  test("only in front: a swing from behind lands in full", () => {
    const p = play(SWORDSMAN, 2, 0.9, () => ({ block: true, aimX: 0, aimZ: -1 }));
    assert.equal(me(p).hp, PLAYER.maxHp - SWORD_DAMAGE);
  });

  test("without the stamina to stop it, the guard breaks: the player is staggered, with none left", () => {
    const p = play(SWORDSMAN, 2, 0.9, holding, BLOCK_COST / 2);
    const { stamina, player: state, health } = me(p);
    assert.equal(stamina, 0);
    assert.equal(state.action, "stagger");
    assert.ok(health.hitstun > 0);
    assert.ok(p.events.some((e) => e.type === "block" && e.guardBreak));
    const later = play(SWORDSMAN, 2, 0.9 + PLAYER.block.guardBreakTime + 0.1, (step) => (step < 50 ? holding() : {}),
      BLOCK_COST / 2);
    assert.equal(me(later).player.action, "none", "and gets over it");
  });

  test("walking while blocking is slower", () => {
    const walk = (block: boolean) => me(play(SWORDSMAN, 30, 0.5, () => ({ moveX: 1, block }))).player;
    const distance = (block: boolean) => {
      const p = play({ ...SWORDSMAN, attacks: {} }, 30, 0.5, () => ({ moveX: 1, block }));
      return p.fight.world.require(p.fight.players[0]!, Body).pos.x;
    };
    assert.equal(walk(true).action, "block");
    assert.ok(distance(true) < distance(false) * (PLAYER.block.moveFactor + 0.1));
  });
});

describe("a blocked blade", () => {
  test("stops dead where it met the guard, hits nothing more, and the next swing starts from there", () => {
    const fight = new Fight({
      arena: ARENA, players: [player({ x: 0, y: 0.05, z: 0 })], enemies: [enemy(SWORDSMAN, { x: 0, y: 0.05, z: 2 })],
    });
    const kobold = fight.enemies[0]!, wielder = fight.world.require(kobold, Wielder);
    let blocked: SwingData | null = null;
    while (!blocked && fight.steps < 300) {
      const swing = wielder.swing;
      fight.step([input({ block: true })]);
      if (fight.events.some((e) => e.type === "block")) blocked = swing;
    }
    assert.ok(blocked, "a swing was blocked");
    const turn = strokeOf(blocked).turn;
    while (wielder.swing === blocked) {
      assert.equal(fight.world.has(kobold, ActiveHit), false, `step ${blocked.step}: its hitbox is gone`);
      assert.equal(strokeOf(blocked).turn, turn, `step ${blocked.step}: the blade hasn't moved`);
      fight.step([input({ block: true })]);
    }
    assert.ok(blocked.step >= blocked.letGoAt, "the swing still takes its time");
    assert.deepEqual(wielder.blade, stoppedBlade(blocked));
    assert.ok(wielder.blade.x !== 0 || wielder.blade.y !== 0, "not back at the guard");
  });
});
