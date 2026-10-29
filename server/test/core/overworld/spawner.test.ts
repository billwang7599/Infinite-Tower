import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { OverworldActor } from "../../../src/core/overworld/components.js";
import { Spawner } from "../../../src/core/overworld/spawner.js";
import type { SpawnDef } from "../../../src/core/world/level.js";
import { TEST_LEVEL } from "../../fixtures/level.js";
import { actors, pos, testOverworld } from "./helpers.js";

const DEF: SpawnDef = TEST_LEVEL.spawns[0]!;
/** Divides respawnTime evenly in binary, so the timing is exact. */
const DT = DEF.respawnTime / 8;

/** The player far from every spawn point unless told otherwise. */
function spawner(spawns: SpawnDef[] = [DEF], playerAt = TEST_LEVEL.spawn) {
  const f = testOverworld({ playerAt });
  return { ...f, spawner: new Spawner(f.world, spawns) };
}

function defeat(world: ReturnType<typeof testOverworld>["world"]): void {
  for (const e of actors(world)) world.destroy(e);
  world.flush();
}

describe("Spawner", () => {
  test("spawns one actor per spawn point, where the level says", () => {
    const second: SpawnDef = { ...DEF, at: { x: DEF.at.x, z: -DEF.at.z } };
    const s = spawner([DEF, second]);
    const spawned = actors(s.world);
    assert.equal(spawned.length, 2);
    assert.deepEqual(spawned.map((e) => ({ ...pos(s.world, e) })), [DEF.at, second.at]);
    assert.equal(s.world.require(spawned[0]!, OverworldActor).kind, DEF.enemy);
  });

  test("a defeated actor comes back after respawnTime, not before", () => {
    const s = spawner();
    defeat(s.world);
    for (let i = 0; i < 7; i++) s.spawner.system(s.world, DT);
    assert.equal(actors(s.world).length, 0);
    s.spawner.system(s.world, DT);
    const back = actors(s.world);
    assert.equal(back.length, 1);
    assert.deepEqual({ ...pos(s.world, back[0]!) }, DEF.at);
  });

  test("a living actor isn't duplicated", () => {
    const s = spawner();
    for (let i = 0; i < 40; i++) s.spawner.system(s.world, DT);
    assert.equal(actors(s.world).length, 1);
  });

  test("the respawn timer restarts for each defeat", () => {
    const s = spawner();
    defeat(s.world);
    for (let i = 0; i < 8; i++) s.spawner.system(s.world, DT);
    defeat(s.world);
    for (let i = 0; i < 7; i++) s.spawner.system(s.world, DT);
    assert.equal(actors(s.world).length, 0);
    s.spawner.system(s.world, DT);
    assert.equal(actors(s.world).length, 1);
  });

  test("an actor doesn't pop in on top of the player: it appears mirrored across x instead", () => {
    const s = spawner([DEF], DEF.at);
    const [first] = actors(s.world);
    assert.deepEqual({ ...pos(s.world, first!) }, { x: -DEF.at.x, z: DEF.at.z });

    defeat(s.world);
    for (let i = 0; i < 8; i++) s.spawner.system(s.world, DT);
    const [again] = actors(s.world);
    assert.deepEqual({ ...pos(s.world, again!) }, { x: -DEF.at.x, z: DEF.at.z });
  });

  test("clear() removes everything it spawned, and leaves the player", () => {
    const s = spawner([DEF, { ...DEF, at: { x: 0, z: 0 } }]);
    s.spawner.clear();
    assert.equal(actors(s.world).length, 0);
    assert.equal(s.world.isAlive(s.player), true);
  });
});
