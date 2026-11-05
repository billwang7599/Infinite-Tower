import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Body, FIXED_DT, World, type Entity } from "@infinite-tower/shared";
import { Blend } from "../../../src/modes/battle/context.js";
import { Pace } from "../../../src/modes/battle/pace.js";

const STEP_MS = FIXED_DT * 1000;

function fighterAt(x: number): { world: World; e: Entity } {
  const world = new World(), e = world.spawn();
  world.add(e, Body, { pos: { x, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, centerHeight: 0.9, collider: 0 });
  return { world, e };
}

describe("fighters drawn between the fight's steps", () => {
  test("moving 1 m a step, at 120 frames a second it's drawn half a metre on every frame", () => {
    const { world, e } = fighterAt(0), body = world.require(e, Body);
    let now = 0, step = 0;
    const pace = new Pace(() => now), blend = new Blend(), drawn: number[] = [];
    for (let frame = 0; frame < 24; frame++) {
      const steps = pace.stepsDue(step);
      for (let i = 0; i < steps; i++, step++) {
        blend.keep(world, [e]);
        body.pos.x += 1;
      }
      blend.alpha = pace.alpha;
      drawn.push(blend.pos(world, e).x);
      now += STEP_MS / 2;
    }
    const moved = drawn.slice(1).map((x, i) => x - drawn[i]!);
    assert.ok(moved.every((m) => Math.abs(m - 0.5) < 1e-6), JSON.stringify(moved));
  });

  test("a correction moving the body moves where it's drawn by as much, at any point in the step", () => {
    const { world, e } = fighterAt(0), body = world.require(e, Body), blend = new Blend();
    blend.keep(world, [e]);
    body.pos.x = 1;
    blend.alpha = 0.3;
    const before = blend.pos(world, e).x;
    body.pos.x += 2;
    blend.moved(e, { x: 2, y: 0, z: 0 });
    assert.ok(Math.abs(blend.pos(world, e).x - (before + 2)) < 1e-9);
  });

  test("a fighter with no step kept (new to the fight) is drawn where its body is", () => {
    const { world, e } = fighterAt(3), blend = new Blend();
    blend.alpha = 0.5;
    assert.deepEqual(blend.pos(world, e), world.require(e, Body).pos);
    blend.keep(world, [e]);
    blend.clear();
    world.require(e, Body).pos.x = 5;
    assert.equal(blend.pos(world, e).x, 5);
  });
});
