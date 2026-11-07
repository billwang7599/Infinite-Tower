import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  BOW, Body, FIXED_DT, Health, HYBRID, physicalTakenFactor, Player, Projectile, Stamina, toSteps, type Entity,
  type PlayerInputData, type ProjectileData, type Vec3,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ARENA, dumpState, enemy, FULL_HP, input, player, STATS, STATUE } from "../fixtures.js";

before(() => initPhysics());

const ARROW = BOW.projectile;
const WIDE = { ...ARENA, radius: 40 };
const THIN = { ...STATUE, radius: 0.3, maxHp: 1000 };

const lone = (at: Vec3 = { x: 30, y: 0.05, z: 30 }) => new Fight({
  arena: WIDE, players: [player({ x: -30, y: 0.05, z: -30 })], enemies: [enemy(THIN, at)],
});

function loose(fight: Fight, shooter: Entity, pos: Vec3, vel: Vec3, damage = 10): ProjectileData {
  return fight.world.add(fight.world.spawn(), Projectile, {
    shooter, weapon: "training-bow", pos: { ...pos }, vel: { ...vel }, damage, left: ARROW.lifeTime, stuck: false,
  });
}

const arrows = (fight: Fight) => [...fight.world.query(Projectile)].map(([, a]) => a);

function play(fight: Fight, steps: number, inputs: (s: number) => PlayerInputData[] = () => []): FightEvent[] {
  const events: FightEvent[] = [];
  for (let i = 0; i < steps; i++) {
    fight.step(inputs(fight.steps + 1));
    events.push(...fight.events);
  }
  return events;
}

describe("an arrow in flight", () => {
  test("stays on the arc its velocity and gravity make, step by step", () => {
    const fight = lone(), me = fight.players[0]!;
    const arrow = loose(fight, me, { x: 0, y: 2, z: 0 }, { x: 0, y: 3, z: 10 });
    const t = 20 * FIXED_DT;
    play(fight, 20);
    assert.ok(Math.abs(arrow.pos.y - (2 + 3 * t + (ARROW.gravityMps2 * t * t) / 2)) < 1e-9);
    assert.ok(Math.abs(arrow.pos.z - 10 * t) < 1e-9);
    assert.ok(Math.abs(arrow.vel.y - (3 + ARROW.gravityMps2 * t)) < 1e-9);
  });

  test("is gone once its lifetime runs out", () => {
    const fight = lone(), me = fight.players[0]!;
    loose(fight, me, { x: 0, y: 2, z: 0 }, { x: 0, y: 100, z: 0 });
    play(fight, toSteps(ARROW.lifeTime) - 1);
    assert.equal(arrows(fight).length, 1);
    play(fight, 1);
    assert.equal(arrows(fight).length, 0);
  });

  test("sticks where it meets the floor, lies there a while, then is gone", () => {
    const fight = lone(), me = fight.players[0]!;
    const arrow = loose(fight, me, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 5 });
    for (let i = 0; i < 60 && !arrow.stuck; i++) play(fight, 1);
    assert.equal(arrow.stuck, true);
    assert.ok(Math.abs(arrow.pos.y) < 1e-9, `${arrow.pos.y}`);
    const at = { ...arrow.pos };
    play(fight, toSteps(ARROW.stuckTime) - 1);
    assert.deepEqual(arrows(fight).map((a) => a.pos), [at]);
    play(fight, 1);
    assert.equal(arrows(fight).length, 0);
  });

  test("sticks in the wall", () => {
    const fight = lone(), me = fight.players[0]!;
    const arrow = loose(fight, me, { x: 0, y: 1.5, z: 30 }, { x: 60, y: 2, z: 0 });
    play(fight, 40);
    assert.equal(arrow.stuck, true);
    assert.ok(Math.abs(Math.hypot(arrow.pos.x, arrow.pos.z) - WIDE.radius) < 1e-6);
  });

  test("hits the first foe in its way once, for its damage, and even a fast one doesn't fly through", () => {
    const fight = lone({ x: 0, y: 0.05, z: 10 }), me = fight.players[0]!, foe = fight.enemies[0]!;
    const fast = 1.5 * 2 * THIN.radius / FIXED_DT;
    loose(fight, me, { x: 0, y: 0.5, z: 0 }, { x: 0, y: 0, z: fast }, 7);
    const hits = play(fight, 60).filter((ev) => ev.type === "hit");
    const dealt = 7 * physicalTakenFactor(STATS);
    assert.equal(hits.length, 1);
    const [hit] = hits as [Extract<FightEvent, { type: "hit" }>];
    assert.deepEqual({ ...hit, at: undefined },
      { type: "hit", by: me, target: foe, team: "enemy", damage: dealt, weapon: true, at: undefined });
    assert.ok(Math.abs(hit.at!.z - (10 - THIN.radius - ARROW.radiusM)) < 1e-6, `${hit.at!.z}`);
    assert.equal(fight.world.require(foe, Health).hp, THIN.maxHp - dealt);
    assert.equal(arrows(fight).length, 0);
  });

  test("flies over a foe below its line, and under nothing", () => {
    const fight = lone({ x: 0, y: 0.05, z: 4 }), me = fight.players[0]!, foe = fight.enemies[0]!;
    loose(fight, me, { x: 0, y: 2 * THIN.radius + 0.5, z: 0 }, { x: 0, y: 0, z: 60 });
    play(fight, 20);
    assert.equal(fight.world.require(foe, Health).hp, THIN.maxHp);
  });

  test("never hits its shooter or anyone on the shooter's side", () => {
    const fight = new Fight({
      arena: WIDE, enemies: [enemy(THIN, { x: 0, y: 0.05, z: 8 })],
      players: [player({ x: 0, y: 0.05, z: 0 }), player({ x: 0, y: 0.05, z: 4 })],
    });
    const [me, friend] = fight.players as [Entity, Entity];
    loose(fight, me, { ...fight.world.require(me, Body).pos }, { x: 0, y: 0, z: 30 });
    const hits = play(fight, 60).filter((ev) => ev.type === "hit");
    assert.deepEqual(hits.map((h) => h.type === "hit" && h.target), [fight.enemies[0]]);
    assert.equal(fight.world.require(friend, Health).hp, FULL_HP);
  });
});

describe("an arrow meeting a player", () => {
  const facingOff = () => {
    const fight = new Fight({
      arena: WIDE, duel: true, enemies: [],
      players: [player({ x: 0, y: 0.05, z: 0 }), player({ x: 0, y: 0.05, z: 6 })],
    });
    return { fight, me: fight.players[0]!, them: fight.players[1]! };
  };
  const shoot = (fight: Fight, me: Entity) =>
    loose(fight, me, { ...fight.world.require(me, Body).pos, z: 0.5 }, { x: 0, y: 0, z: 30 }, 10);

  test("lands on a player standing there", () => {
    const { fight, me, them } = facingOff();
    shoot(fight, me);
    play(fight, 30);
    assert.equal(fight.world.require(them, Health).hp, FULL_HP - 10 * physicalTakenFactor(STATS));
  });

  test("is stopped by a held block in front, for a chip and its damage in stamina; from behind it lands", () => {
    const { fight, me, them } = facingOff();
    const blocking = (back: boolean) => () => [input({}), input({ block: true, aimZ: back ? 1 : -1 })];
    play(fight, 20, blocking(false));
    const before = fight.world.require(them, Stamina).value;
    shoot(fight, me);
    const events = play(fight, 30, blocking(false));
    assert.ok(events.some((ev) => ev.type === "block" && ev.by === me && ev.target === them && !ev.perfect));
    assert.equal(fight.world.require(them, Health).hp,
      FULL_HP - 10 * HYBRID.block.chipFraction * physicalTakenFactor(STATS));
    const drained = HYBRID.block.holdStaminaPerSec * 30 * FIXED_DT;
    assert.ok(Math.abs(before - fight.world.require(them, Stamina).value - 10 - drained) < 1e-6);
    assert.equal(arrows(fight).length, 0);

    const behind = facingOff();
    play(behind.fight, 20, blocking(true));
    shoot(behind.fight, behind.me);
    play(behind.fight, 30, blocking(true));
    assert.equal(behind.fight.world.require(behind.them, Health).hp, FULL_HP - 10 * physicalTakenFactor(STATS));
  });

  test("a perfect block stops it whole, and the shooter far off doesn't recoil", () => {
    const { fight, me, them } = facingOff();
    const arrow = shoot(fight, me);
    const events = play(fight, 30, (s) => [input({}), input({ block: s >= 2, aimZ: -1 })]);
    assert.equal(arrow.stuck, false);
    assert.ok(events.some((ev) => ev.type === "block" && ev.perfect));
    assert.equal(fight.world.require(them, Health).hp, FULL_HP);
    assert.equal(fight.world.require(me, Player).action, "none");
  });

  test("passes a player dodging through it", () => {
    const { fight, me, them } = facingOff();
    const arrow = shoot(fight, me);
    play(fight, 6, (s) => [input({}), input({ dodge: s === 4, moveX: 0, aimZ: -1 })]);
    play(fight, 24);
    assert.equal(fight.world.require(them, Health).hp, FULL_HP);
    assert.ok(arrow.pos.z > fight.world.require(them, Body).pos.z, "it flew on past them");
  });
});

describe("arrows and the fight's state", () => {
  test("saved mid-flight and loaded into a fresh fight, it flies on exactly as the first", () => {
    const a = lone({ x: 0, y: 0.05, z: 12 }), me = a.players[0]!;
    loose(a, me, { x: 0, y: 1, z: 0 }, { x: 0, y: 2, z: 25 });
    loose(a, me, { x: 0, y: 1, z: 0 }, { x: 3, y: 0, z: 0 });
    play(a, 10);
    const b = lone({ x: 0, y: 0.05, z: 12 });
    b.load(JSON.parse(JSON.stringify(a.save())));
    assert.equal(dumpState(b), dumpState(a));
    play(a, 30);
    play(b, 30);
    assert.equal(dumpState(b), dumpState(a));
    assert.equal(b.hash(), a.hash());
  });

  test("an arrow changes the hash", () => {
    const a = lone(), b = lone();
    loose(a, a.players[0]!, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 10 });
    assert.notEqual(a.hash(), b.hash());
  });
});
