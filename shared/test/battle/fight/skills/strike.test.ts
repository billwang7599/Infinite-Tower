import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  Body, dodgeCost, ELEMENTS, Enemy, Health, SKILL_EFFECTS, PLAYER, Stamina, Statuses, WEAPONS, type EnemyDef,
  type SkillElement, type Vec3,
} from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import {
  ARENA, BITER, castNow, enemy, FULL_HP, IDLE, input, player, run, segment, skill, STATS, STATUE,
} from "../fixtures.js";

await initPhysics();

const D = SKILL_EFFECTS.damage;
const E = SKILL_EFFECTS.elements, R = SKILL_EFFECTS.reactions, SELF = SKILL_EFFECTS.self;
const at = (x: number, z: number): Vec3 => ({ x, y: 0.05, z });
const ME = at(0, 0);
const NEAR = at(0, 2);

function fightWith(enemies: Vec3[], def: EnemyDef = STATUE, skillpower = STATS.skillpower): Fight {
  return new Fight({
    arena: ARENA, players: [player(ME, { stats: { ...STATS, skillpower } })],
    enemies: enemies.map((e) => enemy(def, e)),
  });
}
const nova = (fight: Fight, ...elements: SkillElement[]) => castNow(fight, skill(segment("nova", elements)));
const self = (fight: Fight, ...elements: SkillElement[]) => castNow(fight, skill(segment("self", elements)));
const statusesOf = (fight: Fight, i: number) => fight.world.require(fight.enemies[i]!, Statuses);
const myStatuses = (fight: Fight) => fight.world.require(fight.players[0]!, Statuses);
const hpOf = (fight: Fight, i: number) => fight.world.require(fight.enemies[i]!, Health).hp;
const hitFor = (fight: Fight, i: number) => fight.events
  .filter((e) => e.type === "hit" && e.target === fight.enemies[i])
  .reduce((sum, e) => sum + (e.type === "hit" ? e.damage : 0), 0);
const close = (actual: number, expected: number, within = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < within, `${actual} vs ${expected}`);

describe("each element", () => {
  for (const element of ELEMENTS) {
    test(`${element} does its share of D`, () => {
      const fight = fightWith([NEAR]);
      nova(fight, element);
      close(hitFor(fight, 0), E[element].damage * D);
    });
  }

  test("D grows with skillpower, by its square root", () => {
    const fight = fightWith([NEAR], STATUE, STATS.skillpower * 4);
    nova(fight, "fire");
    close(hitFor(fight, 0), E.fire.damage * D * 2);
  });

  test("each element is its own damage type: an enemy resisting one takes less of it only", () => {
    const fight = fightWith([NEAR], { ...STATUE, resist: { fire: 0.5 } });
    nova(fight, "fire", "earth");
    close(hitFor(fight, 0), E.fire.damage * D * 0.5 + E.earth.damage * D);
  });

  test("Fire burns for its time, refreshed by another hit, not stacked", () => {
    const fight = fightWith([NEAR]);
    nova(fight, "fire");
    assert.equal(statusesOf(fight, 0).left.burning, E.fire.burnTime);
    close(statusesOf(fight, 0).burnDamagePerSec, E.fire.burnDamagePerSec * D);
    const before = hpOf(fight, 0);
    run(fight, 1);
    close(before - hpOf(fight, 0), E.fire.burnDamagePerSec * D);
    nova(fight, "fire");
    assert.equal(statusesOf(fight, 0).left.burning, E.fire.burnTime);
    close(statusesOf(fight, 0).burnDamagePerSec, E.fire.burnDamagePerSec * D);
    run(fight, E.fire.burnTime + 0.1);
    const after = hpOf(fight, 0);
    run(fight, 1);
    assert.equal(hpOf(fight, 0), after, "burnt out");
  });

  test("Water leaves the target Wet; Light Marked; Darkness Cursed", () => {
    const fresh = fightWith([NEAR]);
    nova(fresh, "water");
    assert.equal(statusesOf(fresh, 0).left.wet, E.water.wetTime);
    const marked = fightWith([NEAR]);
    nova(marked, "light");
    assert.equal(statusesOf(marked, 0).left.marked, E.light.markTime);
    const cursed = fightWith([NEAR]);
    nova(cursed, "darkness");
    assert.equal(statusesOf(cursed, 0).left.cursed, E.darkness.curseTime);
  });

  test("Earth breaks poise and roots", () => {
    const fight = fightWith([NEAR]);
    nova(fight, "earth");
    assert.equal(fight.world.require(fight.enemies[0]!, Enemy).poise, STATUE.poise - E.earth.poiseDamage);
    assert.equal(statusesOf(fight, 0).left.rooted, E.earth.rootTime);
  });

  test("a Rooted enemy walks slower", () => {
    const WALKER: EnemyDef = { ...STATUE, walkSpeed: 3, turnRate: 3 };
    const walked = (root: boolean) => {
      const fight = new Fight({ arena: ARENA, players: [player(at(0, -6))], enemies: [enemy(WALKER, at(0, 4))] });
      run(fight, 0.5);
      if (root) statusesOf(fight, 0).left.rooted = 5;
      const from = fight.world.require(fight.enemies[0]!, Body).pos.z;
      run(fight, 1);
      return from - fight.world.require(fight.enemies[0]!, Body).pos.z;
    };
    close(walked(true), walked(false) * (1 - E.earth.rootSlow), 0.15);
  });

  test("Air knocks the target away from where it hit", () => {
    const fight = fightWith([NEAR]);
    nova(fight, "air");
    run(fight, 0.3);
    assert.ok(fight.world.require(fight.enemies[0]!, Body).pos.z > NEAR.z + 1);
  });

  test("Lightning arcs to the nearest other enemy in range at a share of its damage", () => {
    const far = at(0, 2 + E.lightning.arcRange + 2);
    const fight = fightWith([NEAR, at(3.5, 2 + 3.5), far]);
    castNow(fight, skill(segment("bolt", ["lightning"])));
    for (let i = 0; i < 30 && hitFor(fight, 0) === 0; i++) fight.step([IDLE]);
    close(hitFor(fight, 0), E.lightning.damage * D);
    close(hitFor(fight, 1), E.lightning.damage * D * E.lightning.arcShare);
    assert.equal(hpOf(fight, 2), STATUE.maxHp);
  });

  test("three Shocks stun the target, and the stacks clear", () => {
    const fight = fightWith([NEAR]);
    for (let i = 1; i < E.lightning.maxShocks; i++) {
      nova(fight, "lightning");
      assert.equal(statusesOf(fight, 0).shocks, i);
    }
    nova(fight, "lightning");
    assert.equal(statusesOf(fight, 0).shocks, 0);
    const enemy = fight.world.require(fight.enemies[0]!, Enemy);
    assert.equal(enemy.state, "stunned");
    assert.equal(enemy.duration, E.lightning.stunTime);
  });

  test("Darkness heals the caster a share of its damage", () => {
    const fight = fightWith([NEAR]);
    const health = fight.world.require(fight.players[0]!, Health);
    health.hp = 50;
    nova(fight, "darkness");
    close(health.hp, 50 + E.darkness.damage * D * E.darkness.healShare);
  });

  test("a Cursed enemy's hits do less", () => {
    const bite = (curse: boolean) => {
      const fight = new Fight({ arena: ARENA, players: [player(at(0, -1))], enemies: [enemy(BITER, at(0, 1.5))] });
      if (curse) statusesOf(fight, 0).left.cursed = 10;
      run(fight, 1);
      return FULL_HP - fight.world.require(fight.players[0]!, Health).hp;
    };
    close(bite(true), bite(false) * E.darkness.cursedDamageFactor);
  });
});

describe("reactions", () => {
  test("Conduct: a stage of Water and Lightning conducts at once, the Wet used up", () => {
    const fight = fightWith([NEAR]);
    nova(fight, "water", "lightning");
    const lightning = E.lightning.damage * D * R.conduct.lightningFactor;
    close(hitFor(fight, 0), E.water.damage * D + lightning);
    assert.equal(statusesOf(fight, 0).left.wet, 0);
  });

  test("Conduct: from a Wet target, Lightning arcs to up to two enemies within range", () => {
    const fight = fightWith([at(0, 3), at(4, 3), at(-4, 3), at(5, -4)]);
    castNow(fight, skill(segment("bolt", ["water"])));
    for (let i = 0; i < 30 && statusesOf(fight, 0).left.wet === 0; i++) fight.step([IDLE]);
    castNow(fight, skill(segment("bolt", ["lightning"])));
    for (let i = 0; i < 30 && hitFor(fight, 0) === 0; i++) fight.step([IDLE]);
    const lightning = E.lightning.damage * D * R.conduct.lightningFactor;
    close(hitFor(fight, 0), lightning);
    close(hitFor(fight, 1), lightning * R.conduct.arcShare);
    close(hitFor(fight, 2), lightning * R.conduct.arcShare);
    assert.equal(hpOf(fight, 3), STATUE.maxHp);
    assert.equal(statusesOf(fight, 0).cooldown.conduct, R.conduct.cooldown);
  });

  test("on cooldown, a reaction doesn't happen: the statuses just apply", () => {
    const fight = fightWith([NEAR]);
    nova(fight, "water", "lightning");
    nova(fight, "water", "lightning");
    close(hitFor(fight, 0), E.water.damage * D + E.lightning.damage * D);
    assert.ok(statusesOf(fight, 0).left.wet > 0);
  });

  test("Doused: Fire on Wet burns nothing, and the Wet is gone", () => {
    const fight = fightWith([NEAR]);
    nova(fight, "water");
    nova(fight, "fire");
    assert.equal(statusesOf(fight, 0).left.burning, 0);
    assert.equal(statusesOf(fight, 0).left.wet, 0);
  });

  test("Doused: Water on Burning puts it out, leaving it dry", () => {
    const fight = fightWith([NEAR]);
    nova(fight, "fire");
    nova(fight, "water");
    assert.equal(statusesOf(fight, 0).left.burning, 0);
    assert.equal(statusesOf(fight, 0).left.wet, 0);
  });

  test("Fanned: Air on Burning doubles the burn and spreads it to one enemy nearby", () => {
    const fight = fightWith([NEAR, at(2.5, 2), at(-2 - R.fanned.spreadRange, 2)]);
    castNow(fight, skill(segment("bolt", ["fire"])));
    for (let i = 0; i < 30 && statusesOf(fight, 0).left.burning === 0; i++) fight.step([IDLE]);
    castNow(fight, skill(segment("bolt", ["air"])));
    for (let i = 0; i < 30 && hitFor(fight, 0) === 0; i++) fight.step([IDLE]);
    const burn = E.fire.burnDamagePerSec * D * R.fanned.burnFactor;
    close(statusesOf(fight, 0).burnDamagePerSec, burn);
    close(statusesOf(fight, 1).burnDamagePerSec, burn);
    assert.ok(statusesOf(fight, 1).left.burning > 0);
    assert.equal(statusesOf(fight, 2).left.burning, 0);
  });

  test("Eclipse: Darkness on Marked bursts around the target, uses up the Mark and doesn't Curse", () => {
    const fight = fightWith([at(0, 3), at(2, 3), at(0, -4)]);
    castNow(fight, skill(segment("bolt", ["light"])));
    for (let i = 0; i < 30 && statusesOf(fight, 0).left.marked === 0; i++) fight.step([IDLE]);
    castNow(fight, skill(segment("bolt", ["darkness"])));
    for (let i = 0; i < 30 && hitFor(fight, 0) === 0; i++) fight.step([IDLE]);
    const burst = R.eclipse.damage * D;
    close(hitFor(fight, 0), E.darkness.damage * D + burst);
    close(hitFor(fight, 1), burst);
    assert.equal(hpOf(fight, 2), STATUE.maxHp);
    assert.equal(statusesOf(fight, 0).left.marked, 0);
    assert.equal(statusesOf(fight, 0).left.cursed, 0);
  });

  test("two at once resolve in order: Conduct uses the Wet up before Fire could be Doused", () => {
    const fight = fightWith([NEAR]);
    nova(fight, "water");
    nova(fight, "lightning", "fire");
    assert.ok(statusesOf(fight, 0).left.burning > 0);
    assert.equal(statusesOf(fight, 0).cooldown.doused, 0);
    assert.ok(statusesOf(fight, 0).cooldown.conduct > 0);
  });
});

describe("Self", () => {
  function bitten(prepare: (fight: Fight) => void): { lost: number; moved: number } {
    const fight = new Fight({ arena: ARENA, players: [player(at(0, -1))], enemies: [enemy(BITER, at(0, 1.5))] });
    prepare(fight);
    const from = fight.world.require(fight.players[0]!, Body).pos.z;
    run(fight, 0.8);
    const me = fight.world.require(fight.players[0]!, Body).pos.z;
    return { lost: FULL_HP - fight.world.require(fight.players[0]!, Health).hp, moved: Math.abs(me - from) };
  }

  test("Water clears your harmful statuses and heals you", () => {
    const fight = fightWith([at(0, 6)]);
    const health = fight.world.require(fight.players[0]!, Health);
    health.hp = 50;
    Object.assign(myStatuses(fight).left, { wet: 5, cursed: 5, burning: 3 });
    myStatuses(fight).burnDamagePerSec = 0;
    self(fight, "water");
    assert.equal(myStatuses(fight).left.wet + myStatuses(fight).left.cursed + myStatuses(fight).left.burning, 0);
    close(health.hp, 50 + SELF.water.heal * D);
  });

  test("Light shields you: hits take the shield first", () => {
    const plain = bitten(() => {});
    const shielded = bitten((fight) => {
      myStatuses(fight).left.shielded = SELF.light.time;
      myStatuses(fight).shield = SELF.light.shield * D;
    });
    close(shielded.lost, Math.max(0, plain.lost - SELF.light.shield * D));
    const fight = fightWith([at(0, 6)]);
    self(fight, "light");
    assert.equal(myStatuses(fight).shield, SELF.light.shield * D);
  });

  test("Earth: you take less and aren't knocked back", () => {
    const plain = bitten(() => {});
    const warded = bitten((fight) => { myStatuses(fight).left.warded = SELF.earth.time; });
    close(warded.lost, plain.lost * SELF.earth.damageTakenFactor);
    // Only the biter's body still shoves a little.
    assert.ok(warded.moved < plain.moved / 4);
  });

  test("Fire: your hits do more; Darkness: they heal you", () => {
    const swing = (status: "empowered" | "siphoning" | null) => {
      const fight = new Fight({ arena: ARENA, players: [player(at(0, 0))], enemies: [enemy(STATUE, at(0, 1.4))] });
      if (status) myStatuses(fight).left[status] = 5;
      fight.world.require(fight.players[0]!, Health).hp = 50;
      fight.step([input({ attack: "light" })]);
      run(fight, 0.6);
      return {
        dealt: STATUE.maxHp - fight.world.require(fight.enemies[0]!, Health).hp,
        healed: fight.world.require(fight.players[0]!, Health).hp - 50,
      };
    };
    const plain = swing(null);
    assert.ok(plain.dealt >= WEAPONS.sword.damage);
    close(swing("empowered").dealt, plain.dealt * SELF.fire.damageDealtFactor);
    close(swing("siphoning").healed, plain.dealt * SELF.darkness.healShare);
  });

  test("Air: you move faster and dodge cheaper; Lightning: stamina comes back faster", () => {
    const fight = fightWith([at(0, 6)]);
    self(fight, "air", "lightning");
    const me = fight.players[0]!, stamina = fight.world.require(me, Stamina);
    assert.ok(myStatuses(fight).left.hasted > 0 && myStatuses(fight).left.charged > 0);
    stamina.value = 50;
    fight.step([input({ moveX: 1, dodge: true })]);
    close(stamina.value, 50 - dodgeCost("light")! * SELF.air.dodgeCostFactor);
    run(fight, PLAYER.dodge.duration + PLAYER.staminaRegenDelay + 0.1);
    const regenFrom = stamina.value;
    run(fight, 0.25);
    close(stamina.value - regenFrom, PLAYER.staminaRegenPerSec * SELF.lightning.staminaRegenFactor * 0.25);
    run(fight, 0.3, () => input({ moveX: -1 }));
    const from = fight.world.require(me, Body).pos.x;
    run(fight, 0.25, () => input({ moveX: -1 }));
    close((from - fight.world.require(me, Body).pos.x) / 0.25, PLAYER.moveSpeed * SELF.air.moveFactor, 0.05);
  });
});
