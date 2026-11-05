import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  bagCounts, emptyBag, FIXED_DT, fits, INTERACT_LOOK_RAD, INTERACT_RANGE_M, NO_PILE, type BagItem,
  type Character, type GridSpot, type ItemCounts, type ItemId,
} from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { newPlayer } from "../../../src/core/content/player.js";
import { OnlinePlayers } from "../../../src/core/game/online.js";
import type { GameSession } from "../../../src/core/game/session.js";
import { INTERACT_LAG_SLACK_M, INTERACT_LOOK_SLACK_RAD } from "../../../src/core/overworld/interact.js";
import { PILE_LIFETIME_MS } from "../../../src/core/overworld/piles.js";
import type { Account } from "../../../src/core/ports.js";
import { FakeLink, MemoryPlayerStore } from "../../fixtures/fakes.js";
import { TEST_CHARACTER } from "../../fixtures/world.js";
import { ACCOUNT, startSession, tick } from "./helpers.js";

before(() => initPhysics());

const LOOT: ItemCounts = { "boar-tusk": 1, "boar-hide": 1 };
const REACH_TILES = INTERACT_RANGE_M + INTERACT_LAG_SLACK_M;
const LOOK_RAD = INTERACT_LOOK_RAD + INTERACT_LOOK_SLACK_RAD;
const bagSpot = (x: number, y: number): GridSpot => ({ in: "bag", x, y });

function walk(session: GameSession, moveX: number, moveZ: number): void {
  session.input(session.overworld.playerData(session.me).lastSeq + 1, moveX, moveZ);
  tick(session);
}

function dropBeside(session: GameSession, awayTiles = REACH_TILES - 0.1, loot = LOOT, offRad = 0) {
  const at = session.overworld.playerPos(session.me);
  const spot = { x: at.x + Math.cos(offRad) * awayTiles, z: at.z + Math.sin(offRad) * awayTiles };
  const pile = session.overworld.dropPile(spot, loot)!;
  const items = () => session.overworld.pileItems(pile);
  const spotOf = (item: ItemId): GridSpot => {
    const s = items()?.items.find((stack: BagItem) => stack.item === item);
    if (!s) throw new Error(`no ${item} on the pile`);
    return { in: "pile", x: s.x, y: s.y };
  };
  return { pile, items, spotOf };
}

function facingEast(opts: Parameters<typeof startSession>[0] = {}) {
  const started = startSession(opts);
  walk(started.session, 1, 0);
  return started;
}

function byAPile(opts: Parameters<typeof startSession>[0] = {}) {
  const started = facingEast(opts);
  return { ...started, ...dropBeside(started.session) };
}

const itemsIn = (session: GameSession) => session.bag.items.map((s) => s.item);

function roomFor(session: GameSession, item: ItemId): GridSpot {
  const { bag } = session;
  for (let y = 0; y < bag.rows; y++) {
    for (let x = 0; x < bag.cols; x++) if (fits(bag, item, { x, y }, false)) return bagSpot(x, y);
  }
  throw new Error(`no room for ${item}`);
}

describe("opening a pile", () => {
  test("in reach (with the lag slack) and faced, its items come down with the gear, beside the bag", () => {
    const { session, link, items } = byAPile();
    session.openPile();
    assert.deepEqual(link.last("gear").gear.pile, items());
    assert.deepEqual(session.gear.pile, items());
  });

  test("out of reach, nothing opens", () => {
    const { session, link } = facingEast();
    dropBeside(session, REACH_TILES + 0.1);
    session.openPile();
    assert.deepEqual(link.last("gear").gear.pile, NO_PILE);
  });

  test("only looked at: up to INTERACT_LOOK_RAD (plus the lag slack) round from the way they face, none behind", () => {
    const { session, link } = facingEast();
    dropBeside(session, 1, LOOT, Math.PI);
    dropBeside(session, 1, LOOT, LOOK_RAD + 0.02);
    dropBeside(session, 1, LOOT, -(LOOK_RAD + 0.02));
    session.openPile();
    assert.deepEqual(link.last("gear").gear.pile, NO_PILE);
    const seen = dropBeside(session, 1, LOOT, LOOK_RAD - 0.02);
    session.openPile();
    assert.deepEqual(session.gear.pile, seen.items());
  });

  test("they face the way they last walked", () => {
    const { session } = facingEast();
    const east = dropBeside(session, 1, { "boar-tusk": 1 });
    const north = dropBeside(session, 1, { "boar-meat": 1 }, Math.PI / 2);
    walk(session, 0, 1);
    session.openPile();
    assert.deepEqual(session.gear.pile, north.items());
    walk(session, 1, 0);
    session.openPile();
    assert.deepEqual(session.gear.pile, east.items());
  });

  test("of two in view, the one nearest the way they face opens, not the nearest", () => {
    const { session } = facingEast();
    dropBeside(session, 0.5, { "boar-meat": 1 }, INTERACT_LOOK_RAD * 0.8);
    const centred = dropBeside(session, 1.5, { "boar-tusk": 1 }, -INTERACT_LOOK_RAD * 0.1);
    session.openPile();
    assert.deepEqual(session.gear.pile, centred.items());
  });

  test("not mid-fight", () => {
    const { session, link } = byAPile({ cheats: true });
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    const sent = link.all("gear").length;
    session.openPile();
    assert.equal(link.all("gear").length, sent);
    assert.deepEqual(session.gear.pile, NO_PILE);
  });
});

describe("taking from a pile", () => {
  test("an item dragged into the bag leaves the pile, and the bag is saved soon after", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { session, link, saves, items, spotOf } = byAPile();
    session.openPile();
    session.moveItem(spotOf("boar-tusk"), bagSpot(0, 0), false);
    assert.deepEqual(itemsIn(session), ["boar-tusk"]);
    assert.deepEqual(items()!.items.map((s) => s.item), ["boar-hide"]);
    assert.deepEqual(link.last("gear").gear, session.gear);
    assert.deepEqual(session.gear.pile, items());
    t.mock.timers.tick(5000);
    assert.deepEqual(saves.at(-1)?.bag, session.bag);
  });

  test("taking the last of it makes it vanish, and closes it", () => {
    const { session, link, items, spotOf } = byAPile();
    session.openPile();
    session.moveItem(spotOf("boar-tusk"), bagSpot(0, 0), false);
    session.moveItem(spotOf("boar-hide"), bagSpot(1, 0), false);
    assert.equal(items(), null);
    assert.deepEqual(link.last("gear").gear.pile, NO_PILE);
    assert.deepEqual(itemsIn(session), ["boar-tusk", "boar-hide"]);
  });

  test("nothing is taken from a pile that wasn't opened", () => {
    const { session, items, spotOf } = byAPile();
    const before = items();
    session.moveItem(spotOf("boar-tusk"), bagSpot(0, 0), false);
    assert.deepEqual(session.bag, emptyBag());
    assert.equal(items(), before);
  });

  test("nothing is put onto it", () => {
    const meat = { ...emptyBag(), items: [{ item: "boar-meat" as const, count: 1, x: 0, y: 0, turned: false }] };
    const { session, items } = byAPile({ saved: { bag: meat } });
    session.openPile();
    const before = items();
    session.moveItem(bagSpot(0, 0), { in: "pile", x: 3, y: 1 }, false);
    assert.deepEqual(session.bag, meat);
    assert.equal(items(), before);
  });

  test("not where it doesn't fit in the bag", () => {
    const { session, items, spotOf } = byAPile();
    session.openPile();
    const before = items();
    session.moveItem(spotOf("boar-hide"), bagSpot(5, 3), false);
    assert.deepEqual(session.bag, emptyBag());
    assert.equal(items(), before);
  });
});

describe("a pile closes", () => {
  test("when the bag closes, and the pile stays where it lies", () => {
    const { session, link, items, spotOf } = byAPile();
    session.openPile();
    const before = items();
    session.closeBag();
    assert.deepEqual(link.last("gear").gear.pile, NO_PILE);
    assert.equal(items(), before);
    session.moveItem(spotOf("boar-tusk"), bagSpot(0, 0), false);
    assert.deepEqual(session.bag, emptyBag(), "a closed pile can't be taken from");
  });

  test("when they walk", () => {
    const { session, link } = byAPile();
    session.openPile();
    session.input(1, 1, 0);
    assert.deepEqual(link.last("gear").gear.pile, NO_PILE);
  });

  test("when a fight starts", () => {
    const { session } = byAPile({ cheats: true });
    session.openPile();
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    assert.deepEqual(session.gear.pile, NO_PILE);
  });

  test("when it vanishes, PILE_LIFETIME_MS after it landed", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 0 });
    const { session, link } = byAPile();
    session.openPile();
    t.mock.timers.tick(PILE_LIFETIME_MS);
    tick(session, 3);
    assert.deepEqual(link.last("gear").gear.pile, NO_PILE);
    assert.deepEqual(link.last("state").piles, []);
  });
});

const OTHER: Account = { id: "player-2", username: "other" };
const OTHER_CHARACTER: Character = { ...TEST_CHARACTER, name: "Other", gender: "boy" };

async function twoByAPile() {
  const store = new MemoryPlayerStore();
  store.saved.set(ACCOUNT.id, { ...newPlayer(), character: TEST_CHARACTER });
  store.saved.set(OTHER.id, { ...newPlayer(), character: OTHER_CHARACTER });
  const online = new OnlinePlayers(store, true, 50);
  const join = async (account: Account) => {
    const link = new FakeLink();
    const session = await online.join(link, account);
    assert.ok(session);
    return { link, session };
  };
  const a = await join(ACCOUNT), b = await join(OTHER);
  for (const { session } of [a, b]) walk(session, 1, 0);
  return { online, a, b, ...dropBeside(a.session, 0.5) };
}

describe("a pile among players", () => {
  test("every player in view sees it", async () => {
    const { online, a, b, pile } = await twoByAPile();
    for (let i = 0; i < 3; i++) online.tick(FIXED_DT);
    for (const { link } of [a, b]) assert.deepEqual(link.last("state").piles.map((p) => p.id), [pile]);
  });

  test("what one takes leaves the other's open view of it by the next tick", async () => {
    const { online, a, b, items, spotOf } = await twoByAPile();
    a.session.openPile();
    b.session.openPile();
    a.session.moveItem(spotOf("boar-tusk"), roomFor(a.session, "boar-tusk"), false);
    online.tick(FIXED_DT);
    assert.deepEqual(b.link.last("gear").gear.pile, items());
    assert.deepEqual(b.session.gear.pile.items.map((s) => s.item), ["boar-hide"]);
  });

  test("first come first served: the same item taken by both goes to the first", async () => {
    const { a, b, spotOf } = await twoByAPile();
    a.session.openPile();
    b.session.openPile();
    const tusk = spotOf("boar-tusk");
    const bBag = b.session.bag;
    a.session.moveItem(tusk, roomFor(a.session, "boar-tusk"), false);
    b.session.moveItem(tusk, roomFor(b.session, "boar-tusk"), false);
    assert.equal(bagCounts(a.session.bag)["boar-tusk"], 1);
    assert.equal(b.session.bag, bBag);
    assert.deepEqual(b.link.last("gear").gear.pile.items.map((s) => s.item), ["boar-hide"]);
  });
});
