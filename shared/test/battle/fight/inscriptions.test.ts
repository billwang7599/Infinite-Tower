import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  applyStatus, EMBERS, FIRST_DOOR, Health, INSCRIPTION_IDS, INSCRIPTIONS, newCore, Player, Stamina, STATUS_DEFS,
  Statuses, statusOn, timeLeft, type CoreState, type InscriptionId, type Vec3,
} from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import { ARENA, BOAR, enemy, FULL_HP, IDLE, input, player, run, STATUE, swingTime } from "./fixtures.js";

await initPhysics();

const at = (x: number, z: number): Vec3 => ({ x, y: 0.05, z });
const close = (actual: number, expected: number, within = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < within, `${actual} vs ${expected}`);
const carved = (...inscriptions: InscriptionId[]): CoreState => ({ ...newCore(), inscriptions });

function facingStatue(...inscriptions: InscriptionId[]): Fight {
  return new Fight({
    arena: ARENA, players: [player(at(0, 0), { core: carved(...inscriptions) })], enemies: [enemy(STATUE, at(0, 1.4))],
  });
}

function swing(fight: Fight, settle = swingTime()): void {
  fight.step([input({ attack: "light" })]);
  run(fight, settle);
}

const me = (fight: Fight) => fight.players[0]!;
const foe = (fight: Fight) => fight.enemies[0]!;

describe("inscriptions in a fight", () => {
  test("each carved inscription is a permanent status from the start", () => {
    const fight = facingStatue(...INSCRIPTION_IDS);
    const on = fight.world.require(me(fight), Statuses).on;
    for (const id of INSCRIPTION_IDS) assert.equal(timeLeft(on, INSCRIPTIONS[id].status), Infinity, id);
    run(fight, 2);
    assert.equal(on.length, INSCRIPTION_IDS.length);
  });

  test("Embers: a weapon hit sets the foe burning, and you're never hurt by burning", () => {
    const fight = facingStatue("embers");
    swing(fight);
    const burning = statusOn(fight.world.require(foe(fight), Statuses).on, "burning");
    assert.ok(burning, "the foe burns");
    assert.equal(burning.amount, STATUS_DEFS.embers.mods.weaponBurnPerSec);
    assert.ok(burning.left! <= EMBERS.burnTime);

    const health = fight.world.require(me(fight), Health);
    applyStatus(fight.world.require(me(fight), Statuses).on, "burning", 3, 10);
    run(fight, 1);
    assert.equal(health.hp, FULL_HP);
  });

  test("Red Blade: a weapon hit heals a share of the damage it deals", () => {
    const fight = facingStatue("red-blade");
    const health = fight.world.require(me(fight), Health);
    health.hp = 50;
    swing(fight);
    const dealt = STATUE.maxHp - fight.world.require(foe(fight), Health).hp;
    assert.ok(dealt > 0);
    close(health.hp, 50 + dealt * STATUS_DEFS.redBlade.mods.weaponLifesteal);
  });

  test("Last Breath: on empty you still swing, the stamina you lack paid in HP", () => {
    const plain = facingStatue();
    const before = plain.world.require(me(plain), Stamina).value;
    plain.step([input({ attack: "light" })]);
    const cost = before - plain.world.require(me(plain), Stamina).value;

    const empty = (fight: Fight) => {
      const stamina = fight.world.require(me(fight), Stamina);
      stamina.value = 0;
      stamina.regenDelay = 99;
      fight.step([input({ attack: "light" })]);
      return fight.world.require(me(fight), Player).action;
    };
    assert.notEqual(empty(facingStatue()), "attack", "without it, no swing on empty");
    const breath = facingStatue("last-breath");
    assert.equal(empty(breath), "attack");
    close(breath.world.require(me(breath), Health).hp, FULL_HP - cost * STATUS_DEFS.lastBreath.mods.hpPerStaminaShort);
  });

  test("Last Breath never pays with your last HP", () => {
    const fight = facingStatue("last-breath");
    const health = fight.world.require(me(fight), Health), stamina = fight.world.require(me(fight), Stamina);
    health.hp = 1;
    stamina.value = 0;
    stamina.regenDelay = 99;
    fight.step([input({ attack: "light" })]);
    assert.notEqual(fight.world.require(me(fight), Player).action, "attack");
    assert.equal(health.hp, 1);
  });

  test("First Door: once a fight, a killing blow leaves you standing, untouchable a moment", () => {
    const fight = new Fight({
      arena: ARENA, players: [player(at(0, -1), { core: carved("first-door") })], enemies: [enemy(BOAR, at(0, 1.5))],
    });
    const health = fight.world.require(me(fight), Health), on = () => fight.world.require(me(fight), Statuses).on;
    health.hp = 1;
    for (let i = 0; i < 300 && !statusOn(on(), "openedDoor"); i++) fight.step([IDLE]);
    assert.equal(health.hp, FIRST_DOOR.hpLeft);
    assert.equal(statusOn(on(), "firstDoor"), undefined, "used up for this fight");
    close(timeLeft(on(), "openedDoor"), FIRST_DOOR.openTime, 0.1);
    run(fight, FIRST_DOOR.openTime + 0.1);
    for (let i = 0; i < 300 && health.hp > 0; i++) fight.step([IDLE]);
    assert.equal(health.hp, 0, "the second killing blow kills");
  });
});
