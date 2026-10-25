import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { defineComponent, World } from "@infinite-tower/shared";

const Pos = defineComponent<{ x: number }>("Pos");
const Vel = defineComponent<{ v: number }>("Vel");

describe("World", () => {
  test("components can be added, read, checked and removed", () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Pos, { x: 1 });
    assert.deepEqual(world.get(e, Pos), { x: 1 });
    assert.equal(world.has(e, Pos), true);
    assert.equal(world.get(e, Vel), undefined);
    world.remove(e, Pos);
    assert.equal(world.has(e, Pos), false);
  });

  test("require throws when the component is missing, naming it", () => {
    const world = new World();
    const e = world.spawn();
    assert.throws(() => world.require(e, Vel), /has no Vel/);
  });

  test("query yields only entities that have every component", () => {
    const world = new World();
    const both = world.spawn(), posOnly = world.spawn();
    world.add(both, Pos, { x: 1 });
    world.add(both, Vel, { v: 2 });
    world.add(posOnly, Pos, { x: 3 });
    assert.deepEqual([...world.query(Pos, Vel)], [[both, { x: 1 }, { v: 2 }]]);
    assert.equal([...world.query(Pos)].length, 2);
    assert.deepEqual(world.first(Vel), [both, { v: 2 }]);
  });

  test("destroy is deferred: gone from queries at once, removed at flush", () => {
    const world = new World();
    const e = world.spawn();
    world.add(e, Pos, { x: 1 });
    world.destroy(e);
    assert.equal(world.isAlive(e), false);
    assert.equal(world.first(Pos), undefined);
    assert.equal(world.has(e, Pos), true, "data stays until flush, so a system mid-iteration can still read it");
    world.flush();
    assert.equal(world.has(e, Pos), false);
  });

  test("onRemove hooks run for remove() and for destroyed entities", () => {
    const world = new World();
    const removed: number[] = [];
    world.onRemove(Pos, (_e, data) => removed.push(data.x));
    const a = world.spawn(), b = world.spawn();
    world.add(a, Pos, { x: 1 });
    world.add(b, Pos, { x: 2 });
    world.remove(a, Pos);
    world.destroy(b);
    world.flush();
    assert.deepEqual(removed, [1, 2]);
  });

  test("entities are never reused", () => {
    const world = new World();
    const a = world.spawn();
    world.destroy(a);
    world.flush();
    assert.notEqual(world.spawn(), a);
  });
});
