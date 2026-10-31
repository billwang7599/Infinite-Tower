import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { CLOSE_CODES, FIXED_DT, Health, IDLE_INPUT, type Character } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { newPlayer } from "../../../src/core/content/player.js";
import { OnlinePlayers } from "../../../src/core/game/online.js";
import type { GameSession } from "../../../src/core/game/session.js";
import { VIEW_RADIUS_TILES } from "../../../src/core/game/snapshot.js";
import { OverworldPlayer } from "../../../src/core/overworld/components.js";
import type { Account } from "../../../src/core/ports.js";
import { getLevel } from "../../../src/core/world/index.js";
import { FakeLink, MemoryPlayerStore } from "../../fixtures/fakes.js";
import { TEST_CHARACTER } from "../../fixtures/level.js";
import { ACCOUNT, findBoar } from "./helpers.js";

before(() => initPhysics());

const OTHER: Account = { id: "player-2", username: "other" };
const OTHER_CHARACTER: Character = { ...TEST_CHARACTER, name: "Other", gender: "boy" };
// The Grass Field: its one boar is the one these tests watch come and go.
const LEVEL = getLevel("grass-field");
const BOAR_SPAWN = LEVEL.spawns.find((s) => s.enemy === "wild-boar")!;

async function twoPlayers() {
  const store = new MemoryPlayerStore();
  store.saved.set(ACCOUNT.id, { ...newPlayer(), character: TEST_CHARACTER, level: LEVEL.layout.id });
  store.saved.set(OTHER.id, { ...newPlayer(), character: OTHER_CHARACTER, level: LEVEL.layout.id });
  const online = new OnlinePlayers(store, true, 50);
  const join = async (account: Account) => {
    const link = new FakeLink();
    const session = await online.join(link, account);
    assert.ok(session);
    return { link, session };
  };
  const a = await join(ACCOUNT), b = await join(OTHER);
  return { online, store, a, b, join };
}

const ticks = (online: OnlinePlayers, n: number) => { for (let i = 0; i < n; i++) online.tick(FIXED_DT); };
const place = (session: GameSession, at: { x: number; z: number }) => session.overworld.place(session.me, at);
const peersIn = (link: FakeLink) => link.last("state").players;
const actorKinds = (link: FakeLink) => link.last("state").actors.map((a) => a.kind);

describe("one overworld per level, shared by its players", () => {
  test("two players on the same level are in the same overworld", async () => {
    const { a, b } = await twoPlayers();
    assert.equal(a.session.overworld, b.session.overworld);
    assert.equal([...a.session.overworld.world.query(OverworldPlayer)].length, 2);
  });

  test("each sees the other, not themselves, with their character the first time", async () => {
    const { online, a, b } = await twoPlayers();
    place(b.session, { x: LEVEL.spawn.x + 2, z: LEVEL.spawn.z });
    ticks(online, 3);
    const seen = peersIn(a.link);
    assert.equal(seen.length, 1);
    assert.equal(seen[0]!.id, b.session.me);
    assert.deepEqual(seen[0]!.character, OTHER_CHARACTER);
    assert.equal(seen[0]!.x, LEVEL.spawn.x + 2);
    assert.equal(seen[0]!.fighting, false);
    assert.deepEqual(peersIn(b.link).map((p) => p.character), [TEST_CHARACTER]);
    ticks(online, 3);
    assert.equal(peersIn(a.link)[0]!.character, undefined, "a character is sent once");
  });

  test("a player walking is seen moving by the other", async () => {
    const { online, a, b } = await twoPlayers();
    const from = b.session.overworld.playerPos(b.session.me);
    for (let seq = 1; seq <= 30; seq++) {
      b.session.input(seq, 1, 0);
      online.tick(FIXED_DT);
    }
    const peer = peersIn(a.link)[0]!;
    assert.ok(peer.x > from.x + 1, `seen at ${peer.x}`);
    assert.ok(peer.vx > 0);
  });

  test("a player stood still for a moment is seen standing", async () => {
    const { online, a, b } = await twoPlayers();
    for (let seq = 1; seq <= 10; seq++) {
      b.session.input(seq, 1, 0);
      online.tick(FIXED_DT);
    }
    ticks(online, 12);
    assert.equal(peersIn(a.link)[0]!.vx, 0);
  });

  test("players past the view's radius aren't sent", async () => {
    const { online, a, b } = await twoPlayers();
    const at = a.session.overworld.playerPos(a.session.me);
    place(b.session, { x: at.x + VIEW_RADIUS_TILES + 1, z: at.z });
    ticks(online, 3);
    assert.deepEqual(peersIn(a.link), []);
  });

  test("a player who leaves is gone from the world and from the other's view", async () => {
    const { online, a, b } = await twoPlayers();
    online.leave(b.session);
    ticks(online, 3);
    assert.deepEqual(peersIn(a.link), []);
    assert.equal([...a.session.overworld.world.query(OverworldPlayer)].length, 1);
  });

  test("a second tab takes the player's place: one of them in the world, not two", async () => {
    const { online, a, join } = await twoPlayers();
    const again = await join(OTHER);
    ticks(online, 3);
    assert.equal(peersIn(a.link).length, 1);
    assert.equal(peersIn(a.link)[0]!.id, again.session.me);
    assert.equal([...a.session.overworld.world.query(OverworldPlayer)].length, 2);
  });
});

describe("shared enemies", () => {
  test("the first to touch an enemy fights it, and it's gone for everyone", async () => {
    const { online, a, b } = await twoPlayers();
    const { boar, pos } = findBoar(a.session);
    place(b.session, { x: pos.x + 0.5, z: pos.z });
    place(a.session, pos);
    online.tick(FIXED_DT);
    assert.equal(a.session.battle?.source ?? b.session.battle?.source, boar);
    const fighter = a.session.battle ? a : b, other = fighter === a ? b : a;
    assert.equal(other.session.battle, null, "only one of them fights it");
    assert.equal(other.session.overworld.world.isAlive(boar), false);
    ticks(online, 3);
    assert.ok(!other.link.last("state").actors.some((s) => s.id === boar));
  });

  test("a player in a battle stays where they were, seen with the fighting marker", async () => {
    const { online, a, b } = await twoPlayers();
    place(b.session, { x: LEVEL.spawn.x + 1, z: LEVEL.spawn.z });
    a.session.cheat({ kind: "encounter", enemy: "wild-boar" });
    const at = a.session.overworld.playerPos(a.session.me);
    ticks(online, 3);
    const seen = peersIn(b.link)[0]!;
    assert.equal(seen.fighting, true);
    assert.deepEqual({ x: seen.x, z: seen.z }, at);
  });

  test("a player in a battle can't be touched into another fight", async () => {
    const { online, a, b } = await twoPlayers();
    a.session.cheat({ kind: "encounter", enemy: "wild-boar" });
    const battle = a.session.battle;
    place(b.session, { x: -40, z: -40 });
    place(a.session, findBoar(a.session).pos);
    ticks(online, 3);
    assert.equal(a.session.battle, battle);
    assert.equal(a.link.all("encounter").length, 1);
  });

  test("a fought enemy comes back respawnTime after its fight is decided, its fighter still in the arena", async () => {
    const { online, a, b } = await twoPlayers();
    place(b.session, { x: BOAR_SPAWN.at.x - 10, z: BOAR_SPAWN.at.z });
    const { boar, pos } = findBoar(a.session);
    place(a.session, pos);
    online.tick(FIXED_DT);
    assert.equal(a.session.battle?.source, boar);
    ticks(online, Math.ceil(BOAR_SPAWN.respawnTime / FIXED_DT) + 5);
    assert.ok(!actorKinds(b.link).includes("wild-boar"), "not back while the fight is on");
    const fight = a.session.battle!.room.fight;
    fight.world.require(fight.players[0]!, Health).hp = 0;
    while (!a.session.battle!.over) {
      const step = fight.steps + 1;
      a.session.battleInput(step, [{ step, ...IDLE_INPUT }]);
      online.tick(FIXED_DT);
    }
    ticks(online, Math.ceil(BOAR_SPAWN.respawnTime / FIXED_DT) - 5);
    assert.ok(!actorKinds(b.link).includes("wild-boar"), "not back before respawnTime");
    ticks(online, 10);
    assert.ok(actorKinds(b.link).includes("wild-boar"));
    assert.ok(a.session.battle, "still on the result screen");
  });

  test("an enemy chases the player nearest it, not one in a battle", async () => {
    const { online, a, b } = await twoPlayers();
    a.session.cheat({ kind: "encounter", enemy: "wild-boar" });
    const { pos } = findBoar(a.session);
    place(a.session, { x: pos.x + 1, z: pos.z });
    place(b.session, { x: pos.x - 3, z: pos.z });
    ticks(online, 120);
    assert.equal(b.link.all("encounter").length, 1, "the boar went for the player not fighting");
  });
});

describe("closing", () => {
  test("a replaced tab is closed and its player removed", async () => {
    const { a, join } = await twoPlayers();
    const again = await join(ACCOUNT);
    assert.equal(a.link.closed?.code, CLOSE_CODES.replaced);
    assert.equal([...again.session.overworld.world.query(OverworldPlayer)].length, 2);
  });
});
