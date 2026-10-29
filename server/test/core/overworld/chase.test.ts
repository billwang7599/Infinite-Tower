import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ChaseOnSight, chaseOnSight, chaseSystem } from "../../../src/core/overworld/behaviors/chase.js";
import { OverworldActor, OverworldPlayer, OverworldPos } from "../../../src/core/overworld/components.js";
import { spawnActor } from "../../../src/core/overworld/parts.js";
import { newWalk } from "../../../src/core/overworld/player.js";
import { TEST_CHARACTER } from "../../fixtures/level.js";
import { pos, testOverworld } from "./helpers.js";

const CHASE = { range: 5, noticeTime: 0.5, speed: 4, giveUpDist: 8 };
/** A power of two, so notice timing adds up exactly. */
const DT = 0.125;

function chaser(playerAt: { x: number; z: number }, actorAt = { x: 0, z: 0 }) {
  const f = testOverworld({ playerAt });
  const e = spawnActor(f.world, "wild-boar", actorAt, [chaseOnSight(CHASE)]);
  const run = chaseSystem();
  return {
    ...f,
    actor: f.world.require(e, OverworldActor),
    chase: f.world.require(e, ChaseOnSight),
    step: (times = 1) => { for (let i = 0; i < times; i++) run(f.world, DT); },
  };
}

describe("chase on sight", () => {
  test("ignores a player out of range", () => {
    const c = chaser({ x: CHASE.range + 1, z: 0 });
    c.step(10);
    assert.equal(c.chase.state, "calm");
    assert.equal(c.actor.alert, false);
    assert.equal(c.actor.busy, false);
  });

  test("notices a player in range: shows '!', takes over from wandering, stands still facing them", () => {
    const c = chaser({ x: -(CHASE.range - 1), z: 0 });
    c.actor.vx = 1;
    c.step();
    assert.equal(c.chase.state, "notice");
    assert.equal(c.actor.alert, true);
    assert.equal(c.actor.busy, true);
    assert.equal(c.actor.vx, 0);
    assert.equal(c.actor.vz, 0);
    assert.equal(c.actor.facing, -1);
  });

  test("stands still for noticeTime, then runs straight at the player at its speed", () => {
    const c = chaser({ x: 1.5, z: 2 });
    c.step();
    const noticeSteps = CHASE.noticeTime / DT;
    c.step(noticeSteps - 1);
    assert.equal(c.chase.state, "notice");
    c.step();
    assert.equal(c.chase.state, "chase");
    c.step();
    assert.ok(Math.abs(Math.hypot(c.actor.vx, c.actor.vz) - CHASE.speed) < 1e-9);
    assert.ok(Math.abs(c.actor.vx / c.actor.vz - 3 / 4) < 1e-9, "heads for the player");
    assert.ok(c.actor.vx > 0 && c.actor.vz > 0);
  });

  test("follows a player who runs away, as long as they stay within giveUpDist", () => {
    const c = chaser({ x: 2, z: 0 });
    c.step(1 + CHASE.noticeTime / DT);
    const player = pos(c.world, c.player);
    player.x = -(CHASE.giveUpDist - 1);
    c.step();
    assert.equal(c.chase.state, "chase");
    assert.ok(c.actor.vx < 0);
  });

  test("gives up once the player is further than giveUpDist", () => {
    const c = chaser({ x: 2, z: 0 });
    c.step(1 + CHASE.noticeTime / DT);
    pos(c.world, c.player).x = CHASE.giveUpDist + 1;
    c.step();
    assert.equal(c.chase.state, "calm");
    assert.equal(c.actor.alert, false);
    assert.equal(c.actor.busy, false);
  });

  // Wander would also stop a boar, but an actor that only chases must not keep running in its last direction.
  test("stops running when it gives up, whether the player got away or became safe", () => {
    const away = chaser({ x: 2, z: 0 });
    away.step(2 + CHASE.noticeTime / DT);
    assert.ok(away.actor.vx > 0);
    pos(away.world, away.player).x = CHASE.giveUpDist + 1;
    away.step();
    assert.deepEqual([away.actor.vx, away.actor.vz], [0, 0]);

    const safe = chaser({ x: 2, z: 0 });
    safe.step(2 + CHASE.noticeTime / DT);
    safe.world.require(safe.player, OverworldPlayer).safeTime = 1;
    safe.step();
    assert.deepEqual([safe.actor.vx, safe.actor.vz], [0, 0]);
  });

  test("gives up when the player becomes safe, and doesn't notice a safe player", () => {
    const c = chaser({ x: 2, z: 0 });
    c.step(1 + CHASE.noticeTime / DT);
    c.world.require(c.player, OverworldPlayer).safeTime = 1;
    c.step();
    assert.equal(c.chase.state, "calm");
    c.step(5);
    assert.equal(c.chase.state, "calm");
    assert.equal(c.actor.alert, false);
  });

  test("giveUpDist defaults to more than the notice range", () => {
    const f = testOverworld();
    const e = spawnActor(f.world, "wild-boar", { x: 0, z: 0 }, [chaseOnSight({ range: 4, noticeTime: 1, speed: 2 })]);
    assert.ok(f.world.require(e, ChaseOnSight).giveUpDist > 4);
  });

  test("with no player in the world it stays calm", () => {
    const c = chaser({ x: 1, z: 0 });
    c.world.remove(c.player, OverworldPos);
    c.step(5);
    assert.equal(c.chase.state, "calm");
  });
  test("goes for the nearest player, passing over one in a battle", () => {
    const c = chaser({ x: 1, z: 0 });
    c.world.require(c.player, OverworldPlayer).fighting = true;
    const other = c.world.spawn();
    c.world.add(other, OverworldPos, { x: 0, z: -3 });
    c.world.add(other, OverworldPlayer, newWalk(TEST_CHARACTER));
    c.step(CHASE.noticeTime / DT + 2);
    assert.equal(c.chase.state, "chase");
    assert.ok(c.actor.vz < 0 && Math.abs(c.actor.vx) < 1e-9, "runs at the one not fighting");
  });
});
