import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  ActiveHit, addItem, BASE_STATS, BLESSING_FAITH, blockStaminaShare, blessingsOf, Body, BOW, BURDEN, carryLimit,
  coreStats, copyInput, DAMAGE_TYPES, drawCost, drawTime, emptyBag, emptyEquipment, FIXED_DT, gearBurden,
  GUARDS, guardOf, guardRaiseTime, Health, HYBRID, IDLE_INPUT, ITEMS, loosedDamage, maxHpOf, newCore, packFor,
  parryWindowTime, perfectBlockTime, Stamina, staminaMaxOf, STAT_POWERS, STATUS_DEFS, STRIKES, TWO_HAND_STRENGTH_FACTOR,
  WEAPONS, Wielder, type Carried, type CoreState, type Damage, type EnemyDef, type Equipment, type Faith, type Grip,
  type LungeDef, type PlayerInputData, type Strike, type Vec3,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent, type PlayerSetup } from "@infinite-tower/shared/fight";
import { combatNumbers } from "../../../../src/ui/hud/character/combatNumbers.js";

await initPhysics();

const close = (actual: number, expected: number, what = "") =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${what} ${actual} vs ${expected}`);

const ARENA = { id: "test", radius: 12, look: "forest-clearing" } as const;
const STATUE: EnemyDef = {
  id: "wild-boar", name: "Statue", maxHp: 100, stats: BASE_STATS, radius: 0.85, walkSpeed: 0, turnRate: 0,
  poise: 1000, poiseRegen: 0, staggerTime: 1, attacks: {},
};
const BITE: LungeDef = {
  triggerDist: 2.8, range: 2.6, minDot: 0.35, windup: 0.3, active: 0.18, recover: 0.5, speed: 6, damage: 10,
  knockback: 8, cooldown: 99, firstDelay: 0,
};
const BITER: EnemyDef = { ...STATUE, turnRate: 3, attacks: { lunge: BITE } };
const ORIGIN: Vec3 = { x: 0, y: 0.05, z: 0 };
type Hit = Extract<FightEvent, { type: "hit" }>;

const holding = (hands: Partial<Equipment>, bag = emptyBag()): Carried =>
  ({ bag, pack: packFor(null), quiver: packFor(null), equipment: { ...emptyEquipment(), ...hands } });
const strong = (strength: number): CoreState => ({ ...newCore(), points: { strength } });
const carrying = (greatswords: number) =>
  holding({}, addItem({ cols: 20, rows: 8, items: [] }, "greatsword", greatswords).bag);
const greatswordsOver = (core: CoreState, share: number) =>
  Math.floor((carryLimit(coreStats(core)) * share) / ITEMS.greatsword.weight) + 1;

function setupOf(gear: Carried, core: CoreState, at = ORIGIN, faith: Faith = {}, stamina?: number): PlayerSetup {
  const stats = coreStats(core);
  return {
    at, vitals: { hp: maxHpOf(stats), stamina: stamina ?? staminaMaxOf(stats) }, stats, core,
    burden: gearBurden(gear, stats), gear, book: [], blessings: blessingsOf(faith),
  };
}

const fightWith = (gear: Carried, core: CoreState, faith: Faith = {}, stamina?: number, statueZ = -10): Fight =>
  new Fight({
    arena: ARENA, players: [setupOf(gear, core, ORIGIN, faith, stamina)],
    enemies: [{ def: STATUE, at: { x: 0, y: 0.05, z: statueZ }, yaw: 0 }],
  });

const idle = (over: Partial<PlayerInputData> = {}): PlayerInputData => ({ ...copyInput(IDLE_INPUT), ...over });
const settle = (fight: Fight) => { for (let s = 0; s < 10; s++) fight.step([idle()]); };

// A swing that meets no one recovers longer (overextended), so this one lands.
function swungInFight(gear: Carried, core: CoreState, strike: Strike) {
  const fight = fightWith(gear, core, {}, undefined, 2), me = fight.players[0]!;
  settle(fight);
  const steps = { windup: 0, live: 0, recover: 0 };
  fight.step([idle({ attack: strike })]);
  for (let s = 0; fight.world.require(me, Wielder).swing !== null && s < 600; s++) {
    if (fight.world.has(me, ActiveHit)) steps.live++;
    else if (steps.live === 0) steps.windup++;
    else steps.recover++;
    fight.step([idle()]);
  }
  const time = (count: number) => count * FIXED_DT;
  return { windupTime: time(steps.windup), liveTime: time(steps.live), recoverTime: time(steps.recover) };
}

describe("the advanced stats' weapon numbers", () => {
  for (const [item, core] of [
    ["sword", newCore()], ["sword", strong(10)], ["greatsword", newCore()], ["greatsword", strong(10)],
  ] as const) {
    test(`a chain's first strike with a ${item} at strength ${coreStats(core).strength} times as the fight's`, () => {
      const gear = holding({ rightHand: item }), [held] = combatNumbers(gear, core, {}).held;
      for (const strike of STRIKES) {
        const shown = held!.strikes![strike], fought = swungInFight(gear, core, strike);
        close(shown.windupTime, fought.windupTime, `${strike} wind-up`);
        close(shown.liveTime, fought.liveTime, `${strike} live`);
        close(shown.recoverTime, fought.recoverTime, `${strike} recovery`);
      }
    });
  }

  test("a lone weapon is held in both hands: hits as a stronger wielder's, costs no more, as fast, says so", () => {
    const core = newCore(), strength = coreStats(core).strength;
    const [two] = combatNumbers(holding({ rightHand: "greatsword" }), core, {}).held;
    const [one] = combatNumbers(holding({ rightHand: "greatsword", leftHand: "skillbook" }), core, {}).held;
    assert.equal(two!.grip, "two");
    assert.equal(one!.grip, "one");
    close(two!.appliedStrength, strength * TWO_HAND_STRENGTH_FACTOR);
    close(one!.appliedStrength, strength);
    assert.equal(two!.minStrength, WEAPONS.greatsword.minStrength);
    close(two!.strikes!.light.windupTime, one!.strikes!.light.windupTime);
    assert.ok(two!.strikes!.light.stamina <= one!.strikes!.light.stamina);
    const [sword] = combatNumbers(holding({ rightHand: "sword" }), core, {}).held;
    const [swordOne] = combatNumbers(holding({ rightHand: "sword", leftHand: "skillbook" }), core, {}).held;
    assert.ok(sword!.strikes!.light.stamina < swordOne!.strikes!.light.stamina);
    for (const strike of STRIKES) {
      for (const type of DAMAGE_TYPES) {
        close(two!.strikes![strike].damage[type],
          one!.strikes![strike].damage[type] * TWO_HAND_STRENGTH_FACTOR ** STAT_POWERS.damage, `${strike} ${type}`);
      }
    }
  });

  for (const [item, core, faith] of [
    ["sword", newCore(), {}], ["greatsword", strong(10), {}], ["longsword", newCore(), { kaelith: BLESSING_FAITH }],
  ] as const) {
    test(`a ${item}'s damage by type at strength ${coreStats(core).strength}, as the fight deals it`, () => {
      const gear = holding({ rightHand: item }), [held] = combatNumbers(gear, core, faith).held;
      for (const strike of STRIKES) {
        const fight = fightWith(gear, core, faith, undefined, 2), me = fight.players[0]!;
        settle(fight);
        let dealt: Damage | undefined;
        fight.step([idle({ attack: strike })]);
        for (let s = 0; s < 120 && !dealt; s++) {
          const hit = fight.events.find((e): e is Hit => e.type === "hit" && e.by === me);
          dealt = hit?.byType;
          fight.step([idle()]);
        }
        for (const type of DAMAGE_TYPES) close(held!.strikes![strike].damage[type], dealt![type], `${strike} ${type}`);
      }
    });
  }

  test("each hand holding a weapon, the right first; a swing's parry window, a bow's draw", () => {
    const core = strong(4), strength = coreStats(core).strength;
    const numbers = combatNumbers(holding({ rightHand: "longsword", leftHand: "training-bow" }), core, {});
    assert.deepEqual(
      numbers.held.map((h) => [h.hand, h.item]), [["rightHand", "longsword"], ["leftHand", "training-bow"]],
    );
    const [blade, bow] = numbers.held;
    close(blade!.parryTime!, parryWindowTime(WEAPONS.longsword));
    assert.equal(blade!.draw, null);
    assert.equal(bow!.strikes, null);
    assert.equal(bow!.parryTime, null);
    const { "training-bow": stave } = WEAPONS;
    assert.deepEqual(bow!.draw, {
      minTime: drawTime(BOW, stave, "minTime"), fullTime: drawTime(BOW, stave, "fullTime"),
      stamina: drawCost(BOW, stave, strength),
      damage: loosedDamage(BOW, stave, drawTime(BOW, stave, "fullTime"), coreStats(core)),
    });
    assert.deepEqual(combatNumbers(holding({ leftHand: "skillbook" }), core, {}).held, []);
  });
});

const GUARDED: readonly (readonly [Grip, Partial<Equipment>])[] = [
  ["shield", { rightHand: "sword", leftHand: "wooden-shield" }],
  ["one", { rightHand: "sword", leftHand: "skillbook" }],
  ["two", { rightHand: "sword" }],
  ["dual", { rightHand: "sword", leftHand: "sword" }],
];

const block = (fight: Fight, target: number) => fight.events
  .find((e): e is Extract<FightEvent, { type: "block" }> => e.type === "block" && e.target === fight.players[target]);

function swungAt(hands: Partial<Equipment>, angleDeg: number, guarding: boolean) {
  const rad = (angleDeg * Math.PI) / 180, distM = 1.6, core = newCore();
  const fight = new Fight({
    arena: ARENA, duel: true, enemies: [],
    players: [
      setupOf(holding({ rightHand: "sword" }), core, { x: Math.sin(rad) * distM, y: 0.05, z: Math.cos(rad) * distM }),
      setupOf(holding(hands), core),
    ],
  });
  const guarder = fight.players[1]!;
  const health = fight.world.require(guarder, Health), stamina = fight.world.require(guarder, Stamina);
  const hpBefore = health.hp;
  let blockCost: number | null = null, lastDrop = 0;
  for (let s = 0; s < 120; s++) {
    const before = stamina.value;
    const attack = s === 30 ? "light" : null;
    fight.step([idle({ aimX: -Math.sin(rad), aimZ: -Math.cos(rad), attack }), idle({ block: guarding })]);
    const drop = before - stamina.value, blocked = block(fight, 1);
    if (blocked) {
      assert.ok(!blocked.perfect);
      blockCost = drop - lastDrop;
    }
    lastDrop = drop;
  }
  return { hpLost: hpBefore - health.hp, blockCost };
}

function pushedBlocking(gear: Carried, core: CoreState): number {
  const fight = new Fight({
    arena: ARENA, players: [setupOf(gear, core)],
    enemies: [{ def: BITER, at: { x: 0, y: 0.05, z: 1.6 }, yaw: Math.PI }],
  });
  const me = fight.players[0]!, body = fight.world.require(me, Body);
  for (let s = 0; s < 120; s++) {
    fight.step([idle({ block: true })]);
    const struck = fight.events.some((e) => (e.type === "hit" || e.type === "block") && e.target === me);
    if (struck) {
      assert.notEqual(block(fight, 0), undefined);
      return Math.hypot(body.vel.x, body.vel.z);
    }
  }
  return assert.fail("never struck");
}
const pushedGuarding = (hands: Partial<Equipment>) => pushedBlocking(holding(hands), newCore());

describe("the advanced stats' guard, as the fight blocks", () => {
  test("a shield over a blade, else the blade in play: its kind, raise time and perfect window", () => {
    const core = newCore();
    const guard = (hands: Partial<Equipment>) => combatNumbers(holding(hands), core, {}).guard;
    for (const [grip, hands] of GUARDED) assert.equal(guard(hands)!.grip, grip);
    assert.equal(guard({ leftHand: "wooden-shield" })!.kind, "shield");
    const shield = guardOf({ rightHand: "sword", leftHand: "wooden-shield" })!.guard;
    const shielded = guard({ rightHand: "sword", leftHand: "wooden-shield" })!;
    close(shielded.raiseTime, guardRaiseTime(shield));
    close(shielded.perfectTime, perfectBlockTime(shield));
    const great = guard({ rightHand: "greatsword", leftHand: "skillbook" })!;
    close(great.raiseTime, guardRaiseTime(WEAPONS.greatsword));
    close(great.perfectTime, perfectBlockTime(WEAPONS.greatsword));
    assert.equal(guard({ leftHand: "skillbook" }), null);
  });

  for (const [kind, hands] of GUARDED) {
    const guard = combatNumbers(holding(hands), newCore(), {}).guard!;

    if (kind === "two") {
      test("two: a blade in both hands guards as one blade, for less stamina, as a stronger blocker", () => {
        const one = combatNumbers(holding({ rightHand: "sword", leftHand: "skillbook" }), newCore(), {}).guard!;
        assert.equal(guard.kind, "one");
        const gripped = coreStats(newCore()).strength * TWO_HAND_STRENGTH_FACTOR;
        close(guard.blockStaminaShare, blockStaminaShare(GUARDS.one, gripped));
        close(guard.chipFraction, one.chipFraction);
      });
    }

    test(`${kind}: the chip let through and the stamina a blocked blow costs`, () => {
      const open = swungAt(hands, 0, false), shut = swungAt(hands, 0, true);
      assert.equal(open.blockCost, null);
      assert.ok(open.hpLost > 0);
      close(shut.hpLost / open.hpLost, guard.chipFraction, "chip");
      close(shut.blockCost! / open.hpLost, guard.blockStaminaShare, "stamina");
    });

    test(`${kind}: it covers its arc and no more`, () => {
      const halfDeg = guard.arcDeg / 2;
      assert.notEqual(swungAt(hands, halfDeg - 10, true).blockCost, null);
      assert.equal(swungAt(hands, halfDeg + 10, true).blockCost, null);
    });

    test(`${kind}: a blocked body blow pushes as hard as it says`, () => {
      close(pushedGuarding(hands), BITE.knockback * HYBRID.block.pushbackFactor * guard.pushFactor, "push");
    });
  }
});

describe("the advanced stats' body numbers", () => {
  test("a dodge costs what the fight takes, by burden; overloaded, there's none", () => {
    const core = newCore(), stats = coreStats(core);
    for (const [greatswords, burden] of [[0, "light"], [greatswordsOver(core, 1), "heavy"]] as const) {
      const gear = carrying(greatswords), fight = fightWith(gear, core);
      const stamina = fight.world.require(fight.players[0]!, Stamina);
      assert.equal(gearBurden(gear, stats), burden);
      settle(fight);
      const before = stamina.value;
      fight.step([idle({ dodge: true })]);
      close(before - stamina.value, combatNumbers(gear, core, {}).dodgeStamina!, burden);
    }
    const overloaded = carrying(greatswordsOver(core, BURDEN.overloadedAt));
    assert.equal(gearBurden(overloaded, stats), "overloaded");
    assert.equal(combatNumbers(overloaded, core, {}).dodgeStamina, null);
  });

  for (const faith of [{}, { haldis: BLESSING_FAITH }] satisfies Faith[]) {
    test(`stamina refills as fast as in the fight (${JSON.stringify(faith)})`, () => {
      const core = newCore(), gear = holding({}), fight = fightWith(gear, core, faith, 0);
      const stamina = fight.world.require(fight.players[0]!, Stamina);
      settle(fight);
      const before = stamina.value, steps = 30;
      for (let s = 0; s < steps; s++) fight.step([idle()]);
      close((stamina.value - before) / (steps * FIXED_DT), combatNumbers(gear, core, faith).staminaRegenPerSec);
    });
  }

  test("a blessing that steadies you shrinks the knockback you take", () => {
    const gear = holding({}), core = newCore();
    assert.equal(combatNumbers(gear, core, {}).knockbackTakenFactor, 1);
    assert.equal(
      combatNumbers(gear, core, { brannoc: BLESSING_FAITH }).knockbackTakenFactor,
      STATUS_DEFS.brannocsAnvil.mods.knockbackFactor,
    );
  });

  test("strength and the core's steps (steadiness) shrink the knockback you take, as a blocked bite pushes you", () => {
    const gear = holding({ rightHand: "sword" }), push = BITE.knockback * HYBRID.block.pushbackFactor;
    for (const core of [newCore(), strong(30), { ...newCore(), steps: 9 }]) {
      const shown = combatNumbers(gear, core, {}).knockbackTakenFactor;
      close(pushedBlocking(gear, core), push * shown, `${core.steps} steps`);
    }
    assert.ok(combatNumbers(gear, strong(30), {}).knockbackTakenFactor < 1);
    assert.ok(combatNumbers(gear, { ...newCore(), steps: 9 }, {}).knockbackTakenFactor < 1);
  });
});
