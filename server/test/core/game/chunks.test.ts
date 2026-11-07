import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  chunkKey, chunksNear, CHUNK_DROP_TILES, CHUNK_SEND_TILES, distToRect, type ChunkData, type Vec2,
} from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { getRegion, WORLD } from "../../../src/core/world/index.js";
import type { FakeLink } from "../../fixtures/fakes.js";
import { dieIn, startSession, tick } from "./helpers.js";

before(() => initPhysics());

const { bounds } = WORLD.layout;
const sent = (link: FakeLink): ChunkData[] => link.all("chunks").flatMap((m) => m.chunks);
const keysNear = (at: Vec2) => chunksNear(bounds, at.x, at.z, CHUNK_SEND_TILES).map((r) => chunkKey(r.x, r.z)).sort();
const keysOf = (chunks: ChunkData[]) => chunks.map((c) => chunkKey(c.x, c.z)).sort();
/** The state goes out every 3rd tick, the chunks with it. */
const STATE_TICKS = 3;

describe("the world a chunk at a time", () => {
  test("entering, the world comes without its tiles, then every chunk near you", () => {
    const { link } = startSession({ saved: { pad: "grass-field" } });
    assert.equal("tiles" in link.last("world").world, false);
    const types = link.sent.map((m) => m.t);
    assert.ok(types.indexOf("chunks") > types.indexOf("world"));
    assert.deepEqual(keysOf(sent(link)), keysNear(getRegion("grass-field").spawn));
  });

  test("walking on, the chunks coming into reach are sent, each once", () => {
    const { session, link } = startSession({ saved: { pad: "grass-field" } });
    const east = { x: getRegion("mistwood").spawn.x, z: getRegion("mistwood").spawn.z };
    session.overworld.place(session.me, east);
    tick(session, STATE_TICKS);
    const all = keysOf(sent(link));
    assert.equal(new Set(all).size, all.length, "none twice");
    for (const key of keysNear(east)) assert.ok(all.includes(key), key);
  });

  test("a chunk left far behind is forgotten, and sent again on coming back", () => {
    const { session, link } = startSession({ saved: { pad: "kingdom" } });
    const start = getRegion("kingdom").spawn, away = getRegion("mistwood").spawn;
    session.overworld.place(session.me, away);
    tick(session, STATE_TICKS);
    const before = link.all("chunks").length;
    session.overworld.place(session.me, start);
    tick(session, STATE_TICKS);
    assert.equal(link.all("chunks").length, before + 1);
    const kept = chunksNear(bounds, start.x, start.z, CHUNK_SEND_TILES)
      .filter((r) => distToRect(r, away.x, away.z) > CHUNK_DROP_TILES).map((r) => chunkKey(r.x, r.z)).sort();
    assert.ok(kept.length > 0);
    assert.deepEqual(keysOf(link.last("chunks").chunks), kept);
  });

  test("dying, your pad's chunks are sent at once, before you leave the arena", () => {
    const { session, link } = startSession({ cheats: true, saved: { pad: "kingdom" } });
    session.overworld.place(session.me, getRegion("mistwood").spawn);
    tick(session, STATE_TICKS);
    dieIn(session);
    assert.ok(session.battle, "still in the arena");
    const all = keysOf(sent(link));
    for (const key of keysNear(getRegion("kingdom").spawn)) assert.ok(all.includes(key), key);
  });
});
