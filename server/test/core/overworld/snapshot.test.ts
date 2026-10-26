import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { FIXED_DT, VIEW, viewHalfWidth } from "@infinite-tower/shared";
import { OverworldActor } from "../../../src/core/overworld/components.js";
import { Overworld } from "../../../src/core/overworld/overworld.js";
import { spawnActor } from "../../../src/core/overworld/parts.js";
import { stateMsg } from "../../../src/core/game/snapshot.js";
import type { LevelDef } from "../../../src/core/levels/level.js";
import { TEST_LEVEL } from "../../fixtures/level.js";

/** Wide enough that the camera follows the player freely around the middle. */
const BIG_LEVEL: LevelDef = {
  ...TEST_LEVEL,
  layout: { ...TEST_LEVEL.layout, halfWidth: 100, halfDepth: 100, grass: [] },
  spawn: { x: 0, z: 0 },
  spawns: [],
};
const HALF_WIDTH = viewHalfWidth(VIEW.maxAspect);

function overworldAtOrigin(): Overworld {
  const overworld = new Overworld(() => {});
  overworld.enter(BIG_LEVEL);
  return overworld;
}

function ids(overworld: Overworld): number[] {
  return stateMsg(overworld).actors.map((a) => a.id);
}

describe("state snapshot", () => {
  test("an actor next to the player is sent with what the client draws", () => {
    const overworld = overworldAtOrigin();
    const e = spawnActor(overworld.world, "boar", { x: 2, z: 1 }, []);
    Object.assign(overworld.world.require(e, OverworldActor), { vx: 1, vz: -1, facing: 1, alert: true });
    const msg = stateMsg(overworld);
    assert.equal(msg.t, "state");
    assert.deepEqual(msg.actors, [{ id: e, kind: "boar", x: 2, z: 1, vx: 1, vz: -1, facing: 1, alert: true }]);
  });

  test("actors just past the screen's edge are still sent, far ones are not", () => {
    const overworld = overworldAtOrigin();
    const edgeX = spawnActor(overworld.world, "boar", { x: HALF_WIDTH + 0.5, z: 0 }, []);
    const edgeZ = spawnActor(overworld.world, "boar", { x: 0, z: -(VIEW.halfHeight + 0.5) }, []);
    spawnActor(overworld.world, "boar", { x: HALF_WIDTH + 50, z: 0 }, []);
    spawnActor(overworld.world, "boar", { x: 0, z: VIEW.halfHeight + 50 }, []);
    spawnActor(overworld.world, "boar", { x: -(HALF_WIDTH + 50), z: -(VIEW.halfHeight + 50) }, []);
    assert.deepEqual(ids(overworld), [edgeX, edgeZ]);
  });

  test("the margin past the screen is the same on both axes and a few tiles at most", () => {
    const overworld = overworldAtOrigin();
    const boarAt = (x: number, z: number) => spawnActor(overworld.world, "boar", { x, z }, []);
    const xs = [1, 2, 3, 4, 5, 6, 8].map((m) => boarAt(HALF_WIDTH + m, 0));
    const zs = [1, 2, 3, 4, 5, 6, 8].map((m) => boarAt(0, VIEW.halfHeight + m));
    const sent = new Set(ids(overworld));
    const xMargin = xs.filter((e) => sent.has(e)).length, zMargin = zs.filter((e) => sent.has(e)).length;
    assert.equal(xMargin, zMargin);
    assert.ok(xMargin >= 1 && xMargin < 8, `margin ${xMargin}`);
  });

  test("the window follows the player", () => {
    const overworld = overworldAtOrigin();
    const far = spawnActor(overworld.world, "boar", { x: 60, z: 40 }, []);
    assert.deepEqual(ids(overworld), []);
    overworld.place({ x: 58, z: 41 });
    assert.deepEqual(ids(overworld), [far]);
  });

  test("near a level's edge the window stops with the camera, so actors further in still show", () => {
    const overworld = new Overworld(() => {});
    overworld.enter({ ...TEST_LEVEL, spawns: [] });
    const { halfWidth } = TEST_LEVEL.layout;
    const cameraStopX = halfWidth + VIEW.overscan - HALF_WIDTH;
    // The player hugs the left edge; the camera stops at -cameraStopX, so the screen reaches further right.
    overworld.place({ x: -(halfWidth - TEST_LEVEL.layout.border), z: 0 });
    const inside = spawnActor(overworld.world, "boar", { x: -cameraStopX + HALF_WIDTH + 0.5, z: 0 }, []);
    assert.deepEqual(ids(overworld), [inside]);
  });

  test("positions and velocities are rounded to 2 decimals", () => {
    const overworld = overworldAtOrigin();
    overworld.place({ x: 1.23456, z: -0.98765 });
    const e = spawnActor(overworld.world, "boar", { x: 3.14159, z: -2.71828 }, []);
    Object.assign(overworld.world.require(e, OverworldActor), { vx: 0.333333, vz: -1.666666 });
    const msg = stateMsg(overworld);
    assert.deepEqual(msg.me, { x: 1.23, z: -0.99 });
    const [a] = msg.actors;
    assert.deepEqual([a!.x, a!.z, a!.vx, a!.vz], [3.14, -2.72, 0.33, -1.67]);
  });

  test("ack is the last input the server simulated", () => {
    const overworld = overworldAtOrigin();
    assert.equal(stateMsg(overworld).ack, 0);
    for (let seq = 1; seq <= 5; seq++) overworld.input(seq, 1, 0);
    for (let i = 0; i < 3; i++) overworld.step(FIXED_DT);
    assert.equal(stateMsg(overworld).ack, 3);
  });

  test("the player isn't listed among the actors", () => {
    const overworld = overworldAtOrigin();
    assert.deepEqual(stateMsg(overworld).actors, []);
  });
});
