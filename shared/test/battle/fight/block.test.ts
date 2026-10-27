/** Blocking (held): a frontal guard that stops hits for stamina, and breaks when the stamina runs out. */
import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Body, Health, physicalDamage, Player, PLAYER, Stamina, type EnemyDef, type PlayerInputData,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ARENA, BITER, BOAR, enemy, input, player, STATS, STATUE } from "./fixtures.js";

before(() => initPhysics());

const BITE_DAMAGE = physicalDamage(BITER.attacks.lunge!.damage, STATS);
/** The boar's charge alone, from across the arena. */
const CHARGER: EnemyDef = { ...BOAR, walkSpeed: 0, attacks: { charge: { ...BOAR.attacks.charge!, firstDelay: 0 } } };

interface Played { fight: Fight; events: FightEvent[] }

/** One player at the middle, aiming +z, against `def` at `enemyZ`; `script` gives the input on each step. */
function play(def: EnemyDef, enemyZ: number, seconds: number, script: (step: number) => Partial<PlayerInputData>,
  stamina: number = STATS.stamina): Played {
  const fight = new Fight({
    arena: { radius: Math.max(ARENA.radius, 12) },
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
  test("a bite in front: no damage, stamina by its damage, and no stagger", () => {
    const p = play(BITER, 2.4, 0.7, holding);
    const { hp, stamina, player: state, health } = me(p);
    assert.equal(hp, PLAYER.maxHp);
    assert.equal(stamina, STATS.stamina - BITE_DAMAGE * PLAYER.block.staminaPerDamage);
    assert.equal(state.action, "block");
    assert.equal(health.hitstun, 0);
    assert.ok(p.events.some((e) => e.type === "block"));
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

  test("only in front: a bite from behind lands in full", () => {
    const p = play(BITER, 2.4, 0.7, () => ({ block: true, aimX: 0, aimZ: -1 }));
    assert.equal(me(p).hp, PLAYER.maxHp - BITE_DAMAGE);
  });

  test("without the stamina to stop it, the guard breaks: the player is staggered, with none left", () => {
    const short = BITE_DAMAGE * PLAYER.block.staminaPerDamage / 2;
    const p = play(BITER, 2.4, 0.7, holding, short);
    const { stamina, player: state, health } = me(p);
    assert.equal(stamina, 0);
    assert.equal(state.action, "stagger");
    assert.ok(health.hitstun > 0);
    assert.ok(p.events.some((e) => e.type === "block" && e.guardBreak));
    const later = play(BITER, 2.4, 0.7 + PLAYER.block.guardBreakTime + 0.1, (step) => (step < 50 ? holding() : {}),
      short);
    assert.equal(me(later).player.action, "none", "and gets over it");
  });

  test("walking while blocking is slower", () => {
    const distance = (block: boolean) => {
      const p = play(STATUE, 30, 0.5, () => ({ moveX: 1, block }));
      return p.fight.world.require(p.fight.players[0]!, Body).pos.x;
    };
    assert.equal(me(play(STATUE, 30, 0.5, () => ({ moveX: 1, block: true }))).player.action, "block");
    assert.ok(distance(true) < distance(false) * (PLAYER.block.moveFactor + 0.1));
  });
});
