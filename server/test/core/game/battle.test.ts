import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { carryLimit, emptyBag, FIXED_DT, ITEMS, type Bag } from "@infinite-tower/shared";
import { ENEMIES } from "../../../src/core/content/enemies.js";
import { fullVitals, PLAYER_STATS } from "../../../src/core/content/player.js";
import { packLoot } from "../../../src/core/game/inventory.js";
import { getLevel, START_LEVEL } from "../../../src/core/levels/index.js";
import { fakeNow, findBoar, HOUR_MS, startSession } from "./helpers.js";

const FULL = fullVitals(PLAYER_STATS);
const LEVEL = getLevel(START_LEVEL);
const HURT = { hp: 50, stamina: 40 };
/** Two meat and a tusk. */
const CARRIED: Bag = {
  ...emptyBag(),
  items: [
    { item: "boar-meat", count: 2, x: 0, y: 0, turned: false },
    { item: "boar-tusk", count: 1, x: 1, y: 0, turned: false },
  ],
};

/** A dev session already in a debug battle, hurt to HURT, carrying `bag`; `clock.ms` is when it started. */
function inBattle(t: Parameters<typeof fakeNow>[0], bag: Bag = emptyBag()) {
  const clock = fakeNow(t);
  const started = startSession({ dev: true, saved: { vitals: { ...HURT }, bag } });
  started.session.debugEncounter();
  return { ...started, clock };
}

describe("starting a battle", () => {
  test("sends encounter with the enemy, the arena, and the player's vitals", () => {
    const { session, link } = startSession({ dev: true, saved: { vitals: { ...HURT } } });
    session.debugEncounter();
    const msg = link.last("encounter");
    assert.equal(msg.source, null);
    assert.deepEqual(msg.enemy, ENEMIES["wild-boar"]);
    assert.deepEqual(msg.arena, LEVEL.arena);
    assert.deepEqual(msg.vitals, HURT);
    assert.deepEqual(msg.stats, session.stats);
  });

  test("says how weighed down the player comes in (the arena applies it)", () => {
    const tusk = ITEMS["boar-tusk"];
    const count = carryLimit(PLAYER_STATS) / tusk.weight + 1;
    const heavy: Bag = {
      cols: count, rows: tusk.rows,
      items: Array.from({ length: count }, (_, x) => ({ item: "boar-tusk", count: 1, x, y: 0, turned: false })),
    };
    const { session, link } = startSession({ dev: true, saved: { bag: heavy } });
    session.debugEncounter();
    assert.equal(link.last("encounter").burden, "heavy");
    const light = startSession({ dev: true });
    light.session.debugEncounter();
    assert.equal(light.link.last("encounter").burden, "light");
  });

  test("touching the overworld boar starts a battle against it", () => {
    const { session, link } = startSession();
    const { boar, pos } = findBoar(session);
    session.overworld.place(pos);
    session.tick(FIXED_DT);
    assert.equal(session.battle?.source, boar);
    assert.equal(link.last("encounter").source, boar);
  });
});

describe("ending a battle", () => {
  test("without a battle does nothing", () => {
    const { session, link, saves } = startSession();
    session.endBattle(true, FULL);
    assert.equal(link.all("battleResult").length, 0);
    assert.equal(saves.length, 0);
    assert.equal(session.wins, 0);
  });

  test("a win claimed at once is refused: no win, full vitals, back at the level's spawn", (t) => {
    const { session, link, saves } = inBattle(t);
    session.overworld.place({ x: 3, z: 3 });
    session.endBattle(true, { hp: 30, stamina: 10 });
    const result = link.last("battleResult");
    assert.equal(result.accepted, false);
    assert.equal(result.won, false);
    assert.equal(result.wins, 0);
    assert.deepEqual(result.loot, {});
    assert.deepEqual(result.leftBehind, {});
    assert.deepEqual(session.vitals, FULL);
    assert.deepEqual(session.overworld.playerPos(), LEVEL.spawn);
    assert.equal(saves.length, 1);
    assert.equal(session.battle, null);
  });

  test("a plausibly timed win counts, saves, and packs the loot into the bag", (t) => {
    t.mock.method(Math, "random", () => 0);
    const { session, link, saves, clock } = inBattle(t);
    clock.ms += HOUR_MS;
    session.endBattle(true, HURT);
    const result = link.last("battleResult");
    assert.equal(result.accepted, true);
    assert.equal(result.won, true);
    assert.equal(result.wins, 1);
    assert.ok((result.loot["boar-meat"] ?? 0) >= 1);
    assert.deepEqual(result.leftBehind, {});
    assert.deepEqual(result.bag, packLoot(emptyBag(), result.loot).bag);
    assert.deepEqual(session.bag, result.bag);
    assert.equal(saves.length, 1);
    assert.equal(saves[0]?.wins, 1);
    assert.deepEqual(saves[0]?.bag, result.bag);
    assert.deepEqual(result.lost, {});
  });

  test("loot the bag has no room for is left behind", (t) => {
    t.mock.method(Math, "random", () => 0);
    const clock = fakeNow(t);
    const full: Bag = { cols: 1, rows: 1, items: [{ item: "boar-tusk", count: 1, x: 0, y: 0, turned: false }] };
    const { session, link } = startSession({ dev: true, saved: { vitals: { ...HURT }, bag: full } });
    session.debugEncounter();
    clock.ms += HOUR_MS;
    session.endBattle(true, HURT);
    const result = link.last("battleResult");
    assert.deepEqual(result.leftBehind, result.loot);
    assert.deepEqual(session.bag, full);
  });

  test("a win with an unlucky roll drops nothing", (t) => {
    t.mock.method(Math, "random", () => 0.999);
    const { session, link, clock } = inBattle(t);
    clock.ms += HOUR_MS;
    session.endBattle(true, HURT);
    assert.equal(link.last("battleResult").won, true);
    assert.deepEqual(session.bag, emptyBag());
  });

  test("a win keeps the player where they were", (t) => {
    const { session, clock } = inBattle(t);
    const before = session.overworld.playerPos();
    clock.ms += HOUR_MS;
    session.endBattle(true, HURT);
    assert.deepEqual(session.overworld.playerPos(), before);
  });

  test("a loss empties the bag for good, saves that, and says what was lost", (t) => {
    const { session, link, saves } = inBattle(t, CARRIED);
    session.endBattle(false, { hp: 0, stamina: 0 });
    const result = link.last("battleResult");
    assert.deepEqual(result.lost, { "boar-meat": 2, "boar-tusk": 1 });
    assert.deepEqual(result.bag, { ...CARRIED, items: [] });
    assert.deepEqual(session.bag, result.bag);
    assert.equal(saves.length, 1);
    assert.deepEqual(saves[0]?.bag, result.bag);
  });

  test("a refused win is a loss: the bag is emptied too", (t) => {
    const { session, link } = inBattle(t, CARRIED);
    session.endBattle(true, HURT);
    const result = link.last("battleResult");
    assert.equal(result.accepted, false);
    assert.deepEqual(result.lost, { "boar-meat": 2, "boar-tusk": 1 });
    assert.deepEqual(session.bag.items, []);
  });

  test("a loss refills vitals and returns the player to the level's spawn", (t) => {
    const { session, link, saves } = inBattle(t);
    session.overworld.place({ x: 3, z: 3 });
    session.endBattle(false, { hp: 0, stamina: 0 });
    const result = link.last("battleResult");
    assert.equal(result.won, false);
    assert.equal(result.accepted, true);
    assert.deepEqual(result.vitals, FULL);
    assert.deepEqual(result.me, LEVEL.spawn);
    assert.equal(saves.length, 1);
  });
});

describe("vitals claimed after a win", () => {
  function winWith(t: Parameters<typeof fakeNow>[0], claimed: { hp: number; stamina: number }) {
    const { session, clock } = inBattle(t);
    clock.ms += HOUR_MS;
    session.endBattle(true, claimed);
    return session.vitals;
  }

  test("are kept when they're possible", (t) => {
    assert.deepEqual(winWith(t, { hp: 20, stamina: 5 }), { hp: 20, stamina: 5 });
  });

  test("more HP than the player came in with becomes what they came in with", (t) => {
    assert.equal(winWith(t, { hp: HURT.hp + 30, stamina: 5 }).hp, HURT.hp);
  });

  test("0 HP on a win becomes 1", (t) => {
    assert.equal(winWith(t, { hp: 0, stamina: 5 }).hp, 1);
  });

  test("stamina above the max becomes the max", (t) => {
    assert.equal(winWith(t, { hp: 20, stamina: PLAYER_STATS.stamina + 50 }).stamina, PLAYER_STATS.stamina);
  });

  test("negative stamina becomes 0", (t) => {
    assert.equal(winWith(t, { hp: 20, stamina: -5 }).stamina, 0);
  });
});

describe("the overworld after a battle", () => {
  test("winning against the overworld boar removes it", (t) => {
    const clock = fakeNow(t);
    const { session } = startSession();
    const { boar, pos } = findBoar(session);
    session.overworld.place(pos);
    session.tick(FIXED_DT);
    clock.ms += HOUR_MS;
    session.endBattle(true, FULL);
    assert.equal(session.overworld.world.isAlive(boar), false);
  });

  test("losing leaves the overworld boar in place", (t) => {
    fakeNow(t);
    const { session } = startSession();
    const { boar, pos } = findBoar(session);
    session.overworld.place(pos);
    session.tick(FIXED_DT);
    session.endBattle(false, FULL);
    assert.equal(session.overworld.world.isAlive(boar), true);
  });

  test("the level's safe time blocks a new encounter right away, and only for that long", (t) => {
    fakeNow(t);
    const { session, link } = startSession();
    const { pos } = findBoar(session);
    session.overworld.place(pos);
    session.tick(FIXED_DT);
    session.endBattle(false, FULL);

    const safeTicks = Math.floor(LEVEL.safeTime / FIXED_DT) - 1;
    for (let i = 0; i < safeTicks; i++) {
      session.overworld.place(findBoar(session).pos);
      session.tick(FIXED_DT);
    }
    assert.equal(link.all("encounter").length, 1);
    assert.equal(session.battle, null);

    for (let i = 0; i < 5 && !session.battle; i++) {
      session.overworld.place(findBoar(session).pos);
      session.tick(FIXED_DT);
    }
    assert.equal(link.all("encounter").length, 2);
  });
});
