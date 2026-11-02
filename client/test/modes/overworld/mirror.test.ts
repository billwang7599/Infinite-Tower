import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  DEFAULT_LOOK, World, type Character, type LevelLayout, type PileSnap, type PlacedNpc, type PlayerSnap,
} from "@infinite-tower/shared";
import { Npc, OverworldActor, OverworldPos, Peer } from "../../../src/modes/overworld/components.js";
import { ActorMirror } from "../../../src/modes/overworld/mirror.js";

const ALICE: Character = { name: "Alice", gender: "girl", look: DEFAULT_LOOK };
const snap = (o: Partial<PlayerSnap> = {}): PlayerSnap => ({ id: 7, x: 1, z: 2, vx: 0, vz: 0, fighting: false, ...o });

function peers(world: World) {
  return [...world.query(Peer, OverworldActor, OverworldPos)].map(([, peer, actor, pos]) => ({ peer, actor, pos }));
}

describe("ActorMirror: other players", () => {
  test("a player is mirrored as a peer with their character, which is kept once it's been sent", () => {
    const world = new World(), mirror = new ActorMirror(world);
    mirror.apply([], [snap({ character: ALICE })], []);
    mirror.apply([], [snap({ x: 3, fighting: true })], []);
    const [only, ...rest] = peers(world);
    assert.equal(rest.length, 0);
    assert.equal(only!.actor.kind, "peer");
    assert.deepEqual(only!.peer, { character: ALICE, fighting: true });
    assert.equal(only!.pos.x, 3);
  });

  test("a mirrored player's entity is found by their server id; anyone not mirrored isn't", () => {
    const world = new World(), mirror = new ActorMirror(world);
    mirror.apply([], [snap({ character: ALICE })], []);
    assert.equal(mirror.entityOf(7), world.first(Peer)?.[0]);
    assert.notEqual(mirror.entityOf(7), undefined);
    assert.equal(mirror.entityOf(8), undefined);
  });

  test("faces the way they walk", () => {
    const world = new World(), mirror = new ActorMirror(world);
    mirror.apply([], [snap({ character: ALICE, vx: 0, vz: 4 })], []);
    assert.equal(peers(world)[0]!.actor.heading, "north");
  });

  test("one whose character was never sent isn't drawn, and one no longer sent is removed", () => {
    const world = new World(), mirror = new ActorMirror(world);
    mirror.apply([], [snap({ id: 8 })], []);
    assert.equal(peers(world).length, 0);
    mirror.apply([], [snap({ character: ALICE })], []);
    mirror.apply([], [], []);
    assert.equal(peers(world).length, 0);
  });

  test("one no longer sent is forgotten: drawn again only once their character comes again", () => {
    const world = new World(), mirror = new ActorMirror(world);
    mirror.apply([], [snap({ character: ALICE })], []);
    mirror.apply([], [], []);
    mirror.apply([], [snap()], []);
    assert.equal(peers(world).length, 0);
  });
});

describe("ActorMirror: piles", () => {
  const pile = (o: Partial<PileSnap> = {}): PileSnap => ({ id: 20, x: 4, z: -1, ...o });
  const piles = (world: World) =>
    [...world.query(OverworldActor, OverworldPos)].filter(([, a]) => a.kind === "pile").map(([, , pos]) => pos);

  test("a pile is mirrored where it lies, and removed once it's no longer sent", () => {
    const world = new World(), mirror = new ActorMirror(world);
    mirror.apply([], [], [pile(), pile({ id: 21, x: 0 })]);
    assert.deepEqual(piles(world), [{ x: 4, z: -1 }, { x: 0, z: -1 }]);
    mirror.apply([], [], [pile({ id: 21, x: 0 })]);
    assert.deepEqual(piles(world), [{ x: 0, z: -1 }]);
  });
});

describe("ActorMirror: NPCs", () => {
  const HOLLIS: PlacedNpc = { npc: "hollis", at: { x: -6, z: 3 }, heading: "west" };
  const levelWith = (...npcs: PlacedNpc[]) => ({ npcs, traces: [], pads: [] } as unknown as LevelLayout);
  const npcs = (world: World) => [...world.query(Npc, OverworldActor, OverworldPos)]
    .map(([, npc, actor, pos]) => ({ id: npc.id, kind: actor.kind, heading: actor.heading, pos }));

  test("a level's NPCs stand where it puts them, facing its way, each known by its id", () => {
    const world = new World(), mirror = new ActorMirror(world);
    mirror.enter(levelWith(HOLLIS));
    assert.deepEqual(npcs(world), [{
      id: "hollis", kind: "npc", heading: "west", pos: { x: -6, z: 3 },
    }]);
  });

  test("they stay through the server's state, and go with the level", () => {
    const world = new World(), mirror = new ActorMirror(world);
    mirror.enter(levelWith(HOLLIS));
    mirror.apply([], [], []);
    assert.equal(npcs(world).length, 1);
    mirror.enter(levelWith());
    assert.equal(npcs(world).length, 0);
    mirror.enter(levelWith(HOLLIS));
    mirror.clear();
    assert.equal(npcs(world).length, 0);
  });
});

describe("ActorMirror: what NPCs left behind", () => {
  const traces = (world: World) => [...world.query(OverworldActor, OverworldPos)]
    .filter(([, actor]) => actor.kind === "trace").map(([, , pos]) => pos);

  test("each lies where the level puts it, and goes with the level", () => {
    const world = new World(), mirror = new ActorMirror(world);
    mirror.enter({ npcs: [], traces: [{ x: -6, z: -3.5 }] } as unknown as LevelLayout);
    mirror.apply([], [], []);
    assert.deepEqual(traces(world), [{ x: -6, z: -3.5 }]);
    assert.equal([...world.query(Npc)].length, 0, "not drawn as the NPC");
    mirror.enter({ npcs: [], traces: [], pads: [] } as unknown as LevelLayout);
    assert.deepEqual(traces(world), []);
  });
});
