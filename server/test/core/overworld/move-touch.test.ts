import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { EnemyId } from "../../../src/core/content/enemies.js";
import { moveSystem } from "../../../src/core/overworld/behaviors/move.js";
import { encounterOnTouch, touchSystem } from "../../../src/core/overworld/behaviors/touch.js";
import { OverworldActor, OverworldPlayer } from "../../../src/core/overworld/components.js";
import { spawnActor } from "../../../src/core/overworld/parts.js";
import { pos, testOverworld } from "./helpers.js";

const ENEMY: EnemyId = "wild-boar";
const TOUCH = { range: 1, enemy: ENEMY };

describe("move", () => {
  test("applies the actor's velocity over dt", () => {
    const f = testOverworld();
    const e = spawnActor(f.world, "boar", { x: 1, z: 1 }, []);
    Object.assign(f.world.require(e, OverworldActor), { vx: 2, vz: -4 });
    moveSystem(f.ctx)(f.world, 0.5);
    assert.deepEqual(pos(f.world, e), { x: 2, z: -1 });
  });

  test("keeps actors inside the level's walkable area", () => {
    const f = testOverworld();
    const { halfWidth, halfDepth, border } = f.ctx.level.layout;
    const e = spawnActor(f.world, "boar", { x: 0, z: 0 }, []);
    Object.assign(f.world.require(e, OverworldActor), { vx: 1000, vz: -1000 });
    moveSystem(f.ctx)(f.world, 1);
    assert.deepEqual(pos(f.world, e), { x: halfWidth - border, z: -(halfDepth - border) });
  });

  test("turns the sprite the way it walks, and keeps it when barely moving sideways", () => {
    const f = testOverworld();
    const e = spawnActor(f.world, "boar", { x: 0, z: 0 }, []);
    const actor = f.world.require(e, OverworldActor);
    const run = moveSystem(f.ctx);
    actor.vx = 1;
    run(f.world, 0.1);
    assert.equal(actor.facing, 1);
    actor.vx = -1;
    run(f.world, 0.1);
    assert.equal(actor.facing, -1);
    Object.assign(actor, { vx: 0.01, vz: 1 });
    run(f.world, 0.1);
    assert.equal(actor.facing, -1);
  });
});

describe("encounter on touch", () => {
  test("touching the player starts a fight against that actor's enemy", () => {
    const f = testOverworld({ playerAt: { x: 0.5, z: 0 } });
    const e = spawnActor(f.world, "boar", { x: 0, z: 0 }, [encounterOnTouch(TOUCH)]);
    touchSystem(f.ctx)(f.world, 0.1);
    assert.deepEqual(f.encounters, [{ source: e, enemy: ENEMY }]);
  });

  test("nothing happens out of range", () => {
    const f = testOverworld({ playerAt: { x: TOUCH.range + 0.1, z: 0 } });
    spawnActor(f.world, "boar", { x: 0, z: 0 }, [encounterOnTouch(TOUCH)]);
    touchSystem(f.ctx)(f.world, 0.1);
    assert.equal(f.encounters.length, 0);
  });

  test("a safe player can't be touched into a fight", () => {
    const f = testOverworld({ playerAt: { x: 0, z: 0 } });
    f.world.require(f.player, OverworldPlayer).safeTime = 1;
    spawnActor(f.world, "boar", { x: 0, z: 0 }, [encounterOnTouch(TOUCH)]);
    touchSystem(f.ctx)(f.world, 0.1);
    assert.equal(f.encounters.length, 0);
  });

  test("two actors touching at once start only one fight", () => {
    const f = testOverworld({ playerAt: { x: 0, z: 0 } });
    spawnActor(f.world, "boar", { x: 0.2, z: 0 }, [encounterOnTouch(TOUCH)]);
    spawnActor(f.world, "boar", { x: -0.2, z: 0 }, [encounterOnTouch(TOUCH)]);
    touchSystem(f.ctx)(f.world, 0.1);
    assert.equal(f.encounters.length, 1);
  });

  test("actors without the part never start fights", () => {
    const f = testOverworld({ playerAt: { x: 0, z: 0 } });
    spawnActor(f.world, "boar", { x: 0, z: 0 }, []);
    touchSystem(f.ctx)(f.world, 0.1);
    assert.equal(f.encounters.length, 0);
  });
});
