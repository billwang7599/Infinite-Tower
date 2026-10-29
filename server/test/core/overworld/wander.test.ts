import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { mapHalfSize } from "@infinite-tower/shared";
import { moveSystem } from "../../../src/core/overworld/behaviors/move.js";
import { Wander, wander, wanderSystem } from "../../../src/core/overworld/behaviors/wander.js";
import { OverworldActor } from "../../../src/core/overworld/components.js";
import { spawnActor } from "../../../src/core/overworld/parts.js";
import { pos, testOverworld } from "./helpers.js";

const SPEED = 2;
const DT = 0.125;

/** rng 0 picks angle 0 (toward +x) and the shortest walk, minDist. */
function wanderer(rng = () => 0) {
  const f = testOverworld({ playerAt: { x: -15, z: 0 }, rng });
  const e = spawnActor(f.world, "wild-boar", { x: 0, z: 0 }, [wander({ speed: SPEED, minDist: 2, maxDist: 4 })]);
  const runWander = wanderSystem(f.ctx), runMove = moveSystem(f.ctx);
  return {
    ...f,
    e,
    actor: f.world.require(e, OverworldActor),
    w: f.world.require(e, Wander),
    step: (times = 1) => {
      for (let i = 0; i < times; i++) { runWander(f.world, DT); runMove(f.world, DT); }
    },
  };
}

describe("wander", () => {
  test("starts idle and stands still for its idle time", () => {
    const a = wanderer();
    a.step(a.w.idleDuration / DT - 1);
    assert.equal(a.w.state, "idle");
    assert.deepEqual(pos(a.world, a.e), { x: 0, z: 0 });
  });

  test("then picks a point between minDist and maxDist away and walks there at its speed", () => {
    const a = wanderer(() => 0.5);
    a.step(a.w.idleDuration / DT);
    assert.equal(a.w.state, "walk");
    const dist = Math.hypot(a.w.targetX, a.w.targetZ);
    assert.ok(dist >= a.w.minDist && dist <= a.w.maxDist, `target ${dist} away`);
    a.step();
    assert.ok(Math.abs(Math.hypot(a.actor.vx, a.actor.vz) - SPEED) < 1e-9);
  });

  test("arrives, stops and idles again", () => {
    const a = wanderer();
    a.step(a.w.idleDuration / DT);
    const target = { x: a.w.targetX, z: a.w.targetZ };
    a.step(Math.ceil(a.w.minDist / SPEED / DT) + 2);
    assert.equal(a.w.state, "idle");
    assert.equal(a.actor.vx, 0);
    const at = pos(a.world, a.e);
    assert.ok(Math.hypot(at.x - target.x, at.z - target.z) < 0.15 + SPEED * DT);
  });

  test("never heads for a solid tile or past the map's edge: it idles on and picks again", () => {
    const a = wanderer();
    const { halfWidth } = mapHalfSize(a.ctx.level.layout);
    pos(a.world, a.e).x = halfWidth - 0.5;
    a.step(a.w.idleDuration / DT);
    assert.equal(a.w.state, "idle");
    assert.equal(a.w.stateTime, 0, "waits out another idle time");
  });

  test("holds off while another behavior is busy, then catches its breath before walking on", () => {
    const a = wanderer();
    const firstIdle = a.w.idleDuration;
    a.step(firstIdle / DT + 1);
    assert.equal(a.w.state, "walk");

    a.actor.busy = true;
    a.actor.vx = -3;
    a.step(4);
    assert.equal(a.actor.vx, -3, "leaves the busy behavior's velocity alone");

    a.actor.busy = false;
    a.step();
    assert.equal(a.w.state, "idle");
    assert.equal(a.actor.vx, 0);
    assert.ok(a.w.idleDuration > firstIdle, "a longer pause than the first one");
  });
});
