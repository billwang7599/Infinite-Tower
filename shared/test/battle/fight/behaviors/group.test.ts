import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { Enemy, Health, type EnemyDef, type Vec3 } from "@infinite-tower/shared";
import { Fight, GROUP, initPhysics } from "@infinite-tower/shared/fight";
import {
  ARENA, BOAR, bodyOf, enemy, flatDist, IDLE, player, run, STATUE, SWORDSMAN, swings,
} from "../fixtures.js";

before(() => initPhysics());

const BITE = BOAR.attacks.lunge!;
const BITER: EnemyDef = { ...BOAR, attacks: { lunge: BITE } };
/** Bites once and never recovers: it keeps its turn for good. */
const HOGGER: EnemyDef = { ...BOAR, attacks: { lunge: { ...BITE, recover: 999 } } };
const WALKER: EnemyDef = { ...STATUE, radius: 0.5, walkSpeed: 3, turnRate: 3 };
const ORIGIN: Vec3 = { x: 0, y: 0.05, z: 0 };
const at = (x: number, z: number): Vec3 => ({ x, y: 0.05, z });
const yawTo = (from: Vec3): number => Math.atan2(-from.x, -from.z);
const near = (def: EnemyDef, p: Vec3) => enemy(def, p, yawTo(p));

const WINDUPS = new Set(["lungeWindup", "chargeWindup", "pounceWindup", "slamWindup", "weaponWindup"]);
const WAITING = new Set(["approach", "stunned", "staggered", "dead", "sidestep"]);

describe("foes in a group take turns on a player", () => {
  const groups: [string, EnemyDef][] = [
    ["biters", BITER],
    ["swordsmen chaining swings",
      { ...SWORDSMAN, walkSpeed: 2.6, attacks: { weapon: swings({ minChain: 3, maxChain: 3, cooldown: 0.5 }) } }],
  ];
  for (const [name, def] of groups) {
    test(`${name}: at most one winds up at a time, and only so many attack at once`, () => {
      const fight = new Fight({
        arena: ARENA, players: [player(ORIGIN)],
        enemies: [near(def, at(0, 2)), near(def, at(1.8, -1)), near(def, at(-1.8, -1)), near(def, at(0, -2.2))],
      });
      const me = fight.world.require(fight.players[0]!, Health);
      const attacked = new Set<number>();
      for (let i = 0; i < 600 && me.hp > me.floor; i++) {
        fight.step([IDLE]);
        const states = fight.enemies.map((e) => fight.world.require(e, Enemy).state);
        states.forEach((s, j) => { if (WINDUPS.has(s)) attacked.add(j); });
        assert.ok(states.filter((s) => WINDUPS.has(s)).length <= 1, `two wind-ups at once: ${states}`);
        assert.ok(states.filter((s) => !WAITING.has(s)).length <= GROUP.maxAttackers, `too many at once: ${states}`);
      }
      assert.ok(attacked.size >= 3, `only ${attacked.size} foes ever attacked`);
    });
  }

  test("a foe whose turn hasn't come never attacks, and holds back out of reach", () => {
    const fight = new Fight({
      arena: ARENA, players: [player(ORIGIN)],
      enemies: [near(HOGGER, at(0, 1.8)), near(HOGGER, at(1.8, 0)), near(BITER, at(-1.8, 0))],
    });
    const third = fight.world.require(fight.enemies[2]!, Enemy);
    for (let i = 0; i < 300; i++) {
      fight.step([IDLE]);
      assert.ok(WAITING.has(third.state), `the third attacked: ${third.state}`);
    }
    const dist = flatDist(bodyOf(fight, fight.enemies[2]!).pos, bodyOf(fight, fight.players[0]!).pos);
    assert.ok(dist > BITE.triggerDist && dist > GROUP.holdM - 0.5, `waits ${dist.toFixed(2)} m away`);
  });

  test("a foe waiting its turn behind the player comes round into view", () => {
    const fight = new Fight({
      arena: ARENA, players: [player(ORIGIN)],
      enemies: [near(HOGGER, at(1, 1.6)), near(HOGGER, at(-1, 1.6)), near(BITER, at(0.3, -4.5))],
    });
    run(fight, 5);
    const p = bodyOf(fight, fight.enemies[2]!).pos, me = bodyOf(fight, fight.players[0]!).pos;
    const x = p.x - me.x, z = p.z - me.z;
    assert.ok(z / Math.hypot(x, z) > GROUP.inViewDot - 0.05, `still out of view at (${x.toFixed(1)}, ${z.toFixed(1)})`);
  });
});

describe("foes in a group spread out", () => {
  test("two walking up one behind the other end side by side, apart, not queued", () => {
    const fight = new Fight({
      arena: ARENA, players: [player(ORIGIN)], enemies: [near(WALKER, at(0.2, 6)), near(WALKER, at(-0.2, 7))],
    });
    run(fight, 5);
    const [a, b] = fight.enemies.map((e) => bodyOf(fight, e).pos) as [Vec3, Vec3];
    assert.ok(flatDist(a, b) > 2 * WALKER.radius + GROUP.spacingM / 2, `${flatDist(a, b).toFixed(2)} m apart`);
    const me = bodyOf(fight, fight.players[0]!).pos;
    for (const p of [a, b]) assert.ok(flatDist(p, me) < 3.2, `one hung back ${flatDist(p, me).toFixed(2)} m away`);
  });
});

describe("with several players, foes split their attention", () => {
  test("a second foe goes for the player nobody is on yet, unless that one is much farther", () => {
    const fight = new Fight({
      arena: ARENA, players: [player(at(-3, 0)), player(at(3, 0))],
      enemies: [near(STATUE, at(-2, 3)), near(STATUE, at(-1, 3))],
    });
    fight.step([IDLE, IDLE]);
    const targets = fight.enemies.map((e) => fight.world.require(e, Enemy).sense.target);
    assert.deepEqual(targets, [fight.players[0], fight.players[1]]);
  });

  test("but every foe goes for the only player still standing", () => {
    const fight = new Fight({
      arena: ARENA, players: [player(at(-3, 0)), player(at(3, 0))],
      enemies: [near(STATUE, at(-2, 3)), near(STATUE, at(-1, 3))],
    });
    fight.world.require(fight.players[0]!, Health).hp = 0;
    fight.step([IDLE, IDLE]);
    for (const e of fight.enemies) assert.equal(fight.world.require(e, Enemy).sense.target, fight.players[1]);
  });
});
