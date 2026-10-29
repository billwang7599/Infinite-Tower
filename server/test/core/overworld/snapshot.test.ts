import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { FIXED_DT, mapHalfSize, WALKER_RADIUS, type Entity } from "@infinite-tower/shared";
import { OverworldActor } from "../../../src/core/overworld/components.js";
import { Overworld } from "../../../src/core/overworld/overworld.js";
import { spawnActor } from "../../../src/core/overworld/parts.js";
import { stateMsg, VIEW_RADIUS_TILES } from "../../../src/core/game/snapshot.js";
import type { LevelDef } from "../../../src/core/world/level.js";
import { TEST_CHARACTER, TEST_LEVEL } from "../../fixtures/level.js";

/** Far wider than the view. */
const BIG_LEVEL: LevelDef = {
  ...TEST_LEVEL,
  layout: { ...TEST_LEVEL.layout, tiles: Array.from({ length: 200 }, () => ".".repeat(200)) },
  spawn: { x: 0, z: 0 },
  spawns: [],
};
function overworldIn(level: LevelDef): { overworld: Overworld; me: Entity } {
  const overworld = new Overworld(level);
  return { overworld, me: overworld.join(TEST_CHARACTER, () => {}) };
}

function ids(overworld: Overworld, me: Entity): number[] {
  return stateMsg(overworld, me, new Set()).actors.map((a) => a.id);
}

describe("state snapshot", () => {
  test("an actor next to the player is sent with what the client draws", () => {
    const { overworld, me } = overworldIn(BIG_LEVEL);
    const e = spawnActor(overworld.world, "wild-boar", { x: 2, z: 1 }, []);
    Object.assign(overworld.world.require(e, OverworldActor), { vx: 1, vz: -1, facing: 1, alert: true });
    const msg = stateMsg(overworld, me, new Set());
    assert.equal(msg.t, "state");
    assert.deepEqual(msg.actors, [{ id: e, kind: "wild-boar", x: 2, z: 1, vx: 1, vz: -1, facing: 1, alert: true }]);
  });

  test("actors within the view's radius are sent whichever way they are, ones past it are not", () => {
    const { overworld, me } = overworldIn(BIG_LEVEL);
    const inside: number[] = [];
    for (let k = 0; k < 16; k++) {
      const a = (k * Math.PI) / 8, at = (r: number) => ({ x: Math.cos(a) * r, z: Math.sin(a) * r });
      inside.push(spawnActor(overworld.world, "wild-boar", at(VIEW_RADIUS_TILES - 0.5), []));
      spawnActor(overworld.world, "wild-boar", at(VIEW_RADIUS_TILES + 0.5), []);
    }
    assert.deepEqual(ids(overworld, me), inside);
  });

  test("the view follows the player", () => {
    const { overworld, me } = overworldIn(BIG_LEVEL);
    const far = spawnActor(overworld.world, "wild-boar", { x: 60, z: 40 }, []);
    assert.deepEqual(ids(overworld, me), []);
    overworld.place(me, { x: 58, z: 41 });
    assert.deepEqual(ids(overworld, me), [far]);
  });

  test("near a level's edge the view stays round the player", () => {
    const { overworld, me } = overworldIn({ ...TEST_LEVEL, spawns: [] });
    const { halfWidth } = mapHalfSize(TEST_LEVEL.layout);
    const x = -(halfWidth - WALKER_RADIUS);
    overworld.place(me, { x, z: 0 });
    const near = spawnActor(overworld.world, "wild-boar", { x: x + VIEW_RADIUS_TILES - 0.5, z: 0 }, []);
    spawnActor(overworld.world, "wild-boar", { x: x + VIEW_RADIUS_TILES + 0.5, z: 0 }, []);
    assert.deepEqual(ids(overworld, me), [near]);
  });

  test("positions and velocities are rounded to 2 decimals", () => {
    const { overworld, me } = overworldIn(BIG_LEVEL);
    overworld.place(me, { x: 1.23456, z: -0.98765 });
    const e = spawnActor(overworld.world, "wild-boar", { x: 3.14159, z: -2.71828 }, []);
    Object.assign(overworld.world.require(e, OverworldActor), { vx: 0.333333, vz: -1.666666 });
    const msg = stateMsg(overworld, me, new Set());
    assert.deepEqual(msg.me, { x: 1.23, z: -0.99 });
    const [a] = msg.actors;
    assert.deepEqual([a!.x, a!.z, a!.vx, a!.vz], [3.14, -2.72, 0.33, -1.67]);
  });

  test("ack is the last input the server simulated", () => {
    const { overworld, me } = overworldIn(BIG_LEVEL);
    assert.equal(stateMsg(overworld, me, new Set()).ack, 0);
    for (let seq = 1; seq <= 5; seq++) overworld.input(me, seq, 1, 0);
    for (let i = 0; i < 3; i++) overworld.step(FIXED_DT);
    assert.equal(stateMsg(overworld, me, new Set()).ack, 3);
  });

  test("the player isn't listed among the actors or the players", () => {
    const { overworld, me } = overworldIn(BIG_LEVEL);
    const msg = stateMsg(overworld, me, new Set());
    assert.deepEqual([msg.actors, msg.players], [[], []]);
  });

  test("another player is sent with their character once, and as fighting while in a battle", () => {
    const { overworld, me } = overworldIn(BIG_LEVEL);
    const other = overworld.join({ ...TEST_CHARACTER, name: "Other" }, () => {});
    overworld.place(other, { x: 1, z: 2 });
    const introduced = new Set<Entity>();
    const [first] = stateMsg(overworld, me, introduced).players;
    assert.deepEqual(first, {
      id: other, x: 1, z: 2, vx: 0, vz: 0, fighting: false, character: { ...TEST_CHARACTER, name: "Other" },
    });
    overworld.startEncounter(other, null, "wild-boar");
    assert.deepEqual(stateMsg(overworld, me, introduced).players, [
      { id: other, x: 1, z: 2, vx: 0, vz: 0, fighting: true },
    ]);
  });

  test("a player who leaves the view or the level is forgotten, and introduced again on coming back", () => {
    const { overworld, me } = overworldIn(BIG_LEVEL);
    const other = overworld.join({ ...TEST_CHARACTER, name: "Other" }, () => {});
    const introduced = new Set<Entity>();
    stateMsg(overworld, me, introduced);
    overworld.place(other, { x: VIEW_RADIUS_TILES + 1, z: 0 });
    stateMsg(overworld, me, introduced);
    assert.equal(introduced.size, 0);
    overworld.place(other, { x: 1, z: 0 });
    assert.ok(stateMsg(overworld, me, introduced).players[0]!.character);
    overworld.leave(other);
    stateMsg(overworld, me, introduced);
    assert.equal(introduced.size, 0);
  });
});
