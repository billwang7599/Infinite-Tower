import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { FIXED_DT } from "@infinite-tower/shared";
import { ENEMIES } from "../../../src/core/content/enemies.js";
import { fullVitals, PLAYER_STATS } from "../../../src/core/content/player.js";
import { getLevel, START_LEVEL } from "../../../src/core/levels/index.js";
import { fakeNow, findBoar, HOUR_MS, startSession } from "./helpers.js";

const FULL = fullVitals(PLAYER_STATS);
const LEVEL = getLevel(START_LEVEL);
const HURT = { hp: 50, stamina: 40 };

/** A dev session already in a debug battle, hurt to HURT; `clock.ms` is when it started. */
function inBattle(t: Parameters<typeof fakeNow>[0]) {
  const clock = fakeNow(t);
  const started = startSession({ dev: true, saved: { vitals: { ...HURT } } });
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

  test("touching the field boar starts a battle against it", () => {
    const { session, link } = startSession();
    const { boar, pos } = findBoar(session);
    session.field.place(pos);
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
    session.field.place({ x: 3, z: 3 });
    session.endBattle(true, { hp: 30, stamina: 10 });
    const result = link.last("battleResult");
    assert.equal(result.accepted, false);
    assert.equal(result.won, false);
    assert.equal(result.wins, 0);
    assert.deepEqual(result.loot, {});
    assert.deepEqual(session.vitals, FULL);
    assert.deepEqual(session.field.playerPos(), LEVEL.spawn);
    assert.equal(saves.length, 1);
    assert.equal(session.battle, null);
  });

  test("a plausibly timed win counts, saves, and adds the loot", (t) => {
    t.mock.method(Math, "random", () => 0);
    const { session, link, saves, clock } = inBattle(t);
    clock.ms += HOUR_MS;
    session.endBattle(true, HURT);
    const result = link.last("battleResult");
    assert.equal(result.accepted, true);
    assert.equal(result.won, true);
    assert.equal(result.wins, 1);
    assert.ok((result.loot["boar-meat"] ?? 0) >= 1);
    assert.deepEqual(result.inventory, result.loot);
    assert.deepEqual(session.inventory, result.loot);
    assert.equal(saves.length, 1);
    assert.equal(saves[0]?.wins, 1);
    assert.deepEqual(saves[0]?.inventory, result.loot);
  });

  test("a win with an unlucky roll drops nothing", (t) => {
    t.mock.method(Math, "random", () => 0.999);
    const { session, link, clock } = inBattle(t);
    clock.ms += HOUR_MS;
    session.endBattle(true, HURT);
    assert.equal(link.last("battleResult").won, true);
    assert.deepEqual(session.inventory, {});
  });

  test("a win keeps the player where they were", (t) => {
    const { session, clock } = inBattle(t);
    const before = session.field.playerPos();
    clock.ms += HOUR_MS;
    session.endBattle(true, HURT);
    assert.deepEqual(session.field.playerPos(), before);
  });

  test("a loss refills vitals and returns the player to the level's spawn", (t) => {
    const { session, link, saves } = inBattle(t);
    session.field.place({ x: 3, z: 3 });
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

describe("the field after a battle", () => {
  test("winning against the field boar removes it", (t) => {
    const clock = fakeNow(t);
    const { session } = startSession();
    const { boar, pos } = findBoar(session);
    session.field.place(pos);
    session.tick(FIXED_DT);
    clock.ms += HOUR_MS;
    session.endBattle(true, FULL);
    assert.equal(session.field.world.isAlive(boar), false);
  });

  test("losing leaves the field boar in place", (t) => {
    fakeNow(t);
    const { session } = startSession();
    const { boar, pos } = findBoar(session);
    session.field.place(pos);
    session.tick(FIXED_DT);
    session.endBattle(false, FULL);
    assert.equal(session.field.world.isAlive(boar), true);
  });

  test("the level's safe time blocks a new encounter right away, and only for that long", (t) => {
    fakeNow(t);
    const { session, link } = startSession();
    const { pos } = findBoar(session);
    session.field.place(pos);
    session.tick(FIXED_DT);
    session.endBattle(false, FULL);

    const safeTicks = Math.floor(LEVEL.safeTime / FIXED_DT) - 1;
    for (let i = 0; i < safeTicks; i++) {
      session.field.place(findBoar(session).pos);
      session.tick(FIXED_DT);
    }
    assert.equal(link.all("encounter").length, 1);
    assert.equal(session.battle, null);

    for (let i = 0; i < 5 && !session.battle; i++) {
      session.field.place(findBoar(session).pos);
      session.tick(FIXED_DT);
    }
    assert.equal(link.all("encounter").length, 2);
  });
});
