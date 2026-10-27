import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { Health, Player, PLAYER } from "@infinite-tower/shared";
import { Fight, initPhysics } from "@infinite-tower/shared/fight";
import {
  ARENA, BITER, bodyOf, duel, flatDist, flatRadius, input, player, RAM, run, STATUE,
} from "../fixtures.js";

before(() => initPhysics());

/** Closest two fighters' centers come on the ground before they touch (and a hair for the physics' skin). */
const TOUCH_DIST = PLAYER.radius + STATUE.radius;
const SKIN = 0.03;

describe("gravity and the floor", () => {
  test("a player dropped from high up falls, lands on the floor and is grounded", () => {
    const fight = new Fight({ arena: ARENA, players: [player({ x: 0, y: 3, z: 0 })], enemies: [] });
    const me = fight.players[0]!;
    run(fight, 0.3);
    assert.equal(fight.world.require(me, Player).grounded, false, "still falling after 0.3 s");
    assert.ok(bodyOf(fight, me).pos.y < 3, "it fell");
    run(fight, 1);
    const body = bodyOf(fight, me);
    assert.equal(fight.world.require(me, Player).grounded, true);
    assert.ok(Math.abs(body.pos.y - PLAYER.height / 2) < SKIN, `feet on the floor (center at ${body.pos.y})`);
    assert.ok(Math.abs(body.vel.y) < 0.5, "not falling any more");
  });

  test("a jump leaves the ground and comes back down onto it", () => {
    const fight = new Fight({ arena: ARENA, players: [player({ x: 0, y: 0.05, z: 0 })], enemies: [] });
    const me = fight.players[0]!;
    run(fight, 0.3);
    run(fight, 0.2, () => input({ jump: true }));
    assert.equal(fight.world.require(me, Player).grounded, false);
    assert.ok(bodyOf(fight, me).pos.y > PLAYER.height / 2 + 0.5, "in the air");
    run(fight, 1.5);
    assert.equal(fight.world.require(me, Player).grounded, true);
  });
});

describe("the arena's wall", () => {
  test("running and dodging outward every way, the player stays inside the ring", () => {
    const fight = new Fight({ arena: ARENA, players: [player({ x: 0, y: 0.05, z: 0 })], enemies: [] });
    const me = fight.players[0]!;
    let farthest = 0;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, moveX = Math.sin(a), moveZ = Math.cos(a);
      for (let step = 0; step < 150; step++) {
        fight.step([input({ moveX, moveZ, dodge: step % 40 === 0 })]);
        farthest = Math.max(farthest, flatRadius(bodyOf(fight, me).pos));
      }
    }
    assert.ok(farthest > ARENA.radius - PLAYER.radius - 0.3, `reached the wall (${farthest})`);
    assert.ok(farthest < ARENA.radius - PLAYER.radius + SKIN, `never went through it (${farthest})`);
  });

  test("a boar ramming the player into the wall: both stay inside, and the boar doesn't go through the player", () => {
    const fight = duel(RAM, { x: 0, y: 0.05, z: ARENA.radius - 1.5 }, { x: 0, y: 0.05, z: ARENA.radius - 4 }, 0);
    const [me, ram] = [fight.players[0]!, fight.enemies[0]!];
    let closest = Infinity;
    for (let step = 0; step < 90; step++) {
      fight.step([input({})]);
      const p = bodyOf(fight, me).pos, r = bodyOf(fight, ram).pos;
      assert.ok(flatRadius(p) < ARENA.radius - PLAYER.radius + SKIN, `the player stays inside (step ${step})`);
      assert.ok(flatRadius(r) < ARENA.radius - RAM.radius + SKIN, `the boar stays inside (step ${step})`);
      closest = Math.min(closest, flatDist(p, r));
    }
    assert.ok(closest > TOUCH_DIST - SKIN, `pinned, not run through (closest ${closest})`);
  });
});

describe("bumping into enemies", () => {
  test("a lunging boar shoves the player ahead of it, and the player never ends up inside it", () => {
    const fight = duel(RAM, { x: 0, y: 0.05, z: 0.5 }, { x: 0, y: 0.05, z: 3 });
    const [me, ram] = [fight.players[0]!, fight.enemies[0]!];
    let closest = Infinity;
    for (let step = 0; step < 90; step++) {
      fight.step([input({})]);
      closest = Math.min(closest, flatDist(bodyOf(fight, me).pos, bodyOf(fight, ram).pos));
    }
    assert.ok(bodyOf(fight, me).pos.z < -1.5, `shoved along the lunge (z ${bodyOf(fight, me).pos.z})`);
    assert.ok(closest > TOUCH_DIST - SKIN, `never inside the boar (closest ${closest})`);
  });

  test("the player can't push the boar: walking into it stops at its side and it doesn't budge", () => {
    const fight = duel(STATUE, { x: 0, y: 0.05, z: 0 }, { x: 0, y: 0.05, z: 2.5 });
    const [me, statue] = [fight.players[0]!, fight.enemies[0]!];
    run(fight, 0.2);
    const before = { ...bodyOf(fight, statue).pos };
    run(fight, 2, () => input({ moveZ: 1 }));
    assert.deepEqual(bodyOf(fight, statue).pos, before);
    const gap = flatDist(bodyOf(fight, me).pos, before);
    assert.ok(gap > TOUCH_DIST - SKIN && gap < TOUCH_DIST + 0.1, `stopped against it (${gap} apart)`);
  });

  test("a boar slows down no more for shoving the player than for passing through one in hitstun", () => {
    const ramEnd = (hitstun: number) => {
      const fight = duel(RAM, { x: 0, y: 0.05, z: 0.5 }, { x: 0, y: 0.05, z: 3 });
      fight.world.require(fight.players[0]!, Health).hitstun = hitstun;
      run(fight, 1.5);
      return bodyOf(fight, fight.enemies[0]!).pos;
    };
    assert.deepEqual(ramEnd(0), ramEnd(3));
  });

  test("in hitstun, the player is passed through: the lunging boar goes by without moving them", () => {
    const fight = duel(RAM, { x: 0, y: 0.05, z: 0.5 }, { x: 0, y: 0.05, z: 3 });
    const me = fight.players[0]!;
    fight.world.require(me, Health).hitstun = 3;
    run(fight, 0.1);
    const before = { ...bodyOf(fight, me).pos };
    run(fight, 1.5);
    assert.ok(flatDist(bodyOf(fight, me).pos, before) < 0.01, "not shoved");
    assert.ok(bodyOf(fight, fight.enemies[0]!).pos.z < before.z, "the boar went past");
  });

  test("dodging, the player passes through the boar", () => {
    const fight = duel(STATUE, { x: 0, y: 0.05, z: 0 }, { x: 0, y: 0.05, z: 1.4 });
    const me = fight.players[0]!;
    run(fight, 0.2);
    run(fight, 0.6, (step) => input({ moveZ: 1, dodge: step === 0 }));
    const z = bodyOf(fight, me).pos.z;
    assert.ok(z > 1.4 + TOUCH_DIST - SKIN, `came out the other side (z ${z})`);
  });

  test("a dodge that ends inside the boar pops the player out beside it, without flinging them", () => {
    const fight = duel(STATUE, { x: 0, y: 0.05, z: 0 }, { x: 0, y: 0.05, z: 3.2 });
    const me = fight.players[0]!;
    run(fight, 0.2);
    run(fight, 1.5, (step) => input({ moveZ: step === 0 ? 1 : 0, dodge: step === 0 }));
    const gap = flatDist(bodyOf(fight, me).pos, bodyOf(fight, fight.enemies[0]!).pos);
    assert.ok(gap > TOUCH_DIST - SKIN && gap < TOUCH_DIST + 0.5, `beside it (${gap} apart)`);
  });

  for (const [what, setUp] of [
    ["knocked back (in hitstun)", (h: { hitstun: number; hp: number }) => { h.hitstun = 2; }],
    ["dead", (h: { hitstun: number; hp: number }) => { h.hp = 0; }],
  ] as const) {
    test(`${what}, the player slides through the boar`, () => {
      const fight = duel(STATUE, { x: 0, y: 0.05, z: 0 }, { x: 0, y: 0.05, z: 1.6 });
      const me = fight.players[0]!;
      run(fight, 0.2);
      setUp(fight.world.require(me, Health));
      bodyOf(fight, me).vel.z = 10;
      run(fight, 1);
      assert.ok(bodyOf(fight, me).pos.z > 1.6, `slid past the boar's middle (z ${bodyOf(fight, me).pos.z})`);
    });
  }
});

describe("knockback", () => {
  test("a bite throws the player back and up, and they land farther away", () => {
    const fight = duel(BITER, { x: 0, y: 0.05, z: 0 }, { x: 0, y: 0.05, z: 2.3 });
    const [me, biter] = [fight.players[0]!, fight.enemies[0]!];
    const lunge = BITER.attacks.lunge!;
    const health = fight.world.require(me, Health);
    let steps = 0;
    while (health.hp === health.max && steps++ < 120) fight.step([input({})]);
    assert.ok(health.hp < health.max, "bitten");

    const vel = bodyOf(fight, me).vel;
    assert.equal(vel.y, lunge.lift);
    assert.ok(Math.abs(Math.hypot(vel.x, vel.z) - lunge.knockback) < 1e-9, "thrown back as hard as the bite says");
    assert.ok(vel.z < 0, "away from the boar");

    const before = flatDist(bodyOf(fight, me).pos, bodyOf(fight, biter).pos);
    fight.step([input({})]);
    assert.equal(fight.world.require(me, Player).grounded, false, "off the ground");
    run(fight, 1.5);
    assert.equal(fight.world.require(me, Player).grounded, true, "landed");
    assert.ok(flatDist(bodyOf(fight, me).pos, bodyOf(fight, biter).pos) > before + 1, "farther away");
  });
});
