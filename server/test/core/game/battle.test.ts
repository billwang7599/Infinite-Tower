import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Body, carryLimit, emptyBag, FIXED_DT, HASH_EVERY_STEPS, Health, IDLE_INPUT, ITEMS, physicalDamage,
  Player, STARTER_SWORD, starterEquipment, type Bag, type Equipment, type PlayerInputData, type Spell, type Word,
} from "@infinite-tower/shared";
import { ENEMY_START, ENEMY_START_YAW, initPhysics, MAX_FIGHT_TIME, PLAYER_START } from "@infinite-tower/shared/fight";
import { ENEMIES } from "../../../src/core/content/enemies.js";
import { fullVitals, PLAYER_STATS } from "../../../src/core/content/player.js";
import { packLoot } from "../../../src/core/game/battle.js";
import type { GameSession } from "../../../src/core/game/session.js";
import { getLevel, START_LEVEL } from "../../../src/core/levels/index.js";
import { findBoar, startSession } from "./helpers.js";

before(() => initPhysics());

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
/** Long enough for any fight here to be decided. */
const MAX_TEST_STEPS = 60 * 60;

/** A dev session already in a debug battle, hurt to HURT, carrying `bag`. */
function inBattle(bag: Bag = emptyBag(), vitals = HURT) {
  const started = startSession({ dev: true, saved: { vitals: { ...vitals }, bag } });
  started.session.debugEncounter();
  return started;
}

const fightOf = (session: GameSession) => {
  const room = session.battle?.room;
  if (!room) throw new Error("not in a battle");
  return room.fight;
};

/** What the player's client would do: send `next()` for each step (numbered), while the server ticks. */
function play(session: GameSession, next: () => PlayerInputData, maxSteps = MAX_TEST_STEPS): void {
  const fight = fightOf(session);
  for (let i = 0; i < maxSteps && session.battle && !session.battle.over; i++) {
    const step = fight.steps + 1;
    session.battleInput(step, [{ step, ...next() }]);
    session.tick(FIXED_DT);
  }
}

/** A player who walks up to the boar and slashes at it, aiming at it the whole time. */
function brawler(session: GameSession): () => PlayerInputData {
  let step = 0;
  return () => {
    const fight = fightOf(session);
    const me = fight.world.require(fight.players[0]!, Body).pos;
    const it = fight.world.require(fight.enemies[0]!, Body).pos;
    const dx = it.x - me.x, dz = it.z - me.z, dist = Math.hypot(dx, dz) || 1;
    const aimX = dx / dist, aimZ = dz / dist, far = dist > 2.6;
    const attack = !far && step++ % 2 === 0 ? (step % 4 === 1 ? "lr" : "rl") : null;
    return { ...IDLE_INPUT, aimX, aimZ, moveX: far ? aimX : 0, moveZ: far ? aimZ : 0, attack };
  };
}

/** The boar one slash from dying, then the brawler: a win, decided by the server from the player's inputs. */
function win(session: GameSession): void {
  const fight = fightOf(session);
  fight.world.require(fight.enemies[0]!, Health).hp = physicalDamage(STARTER_SWORD.damage, PLAYER_STATS);
  play(session, brawler(session));
}

/** Knocked down: the next step decides the fight. */
function lose(session: GameSession): void {
  play(session, () => IDLE_INPUT, 1);
  const fight = fightOf(session);
  fight.world.require(fight.players[0]!, Health).hp = 0;
  play(session, () => IDLE_INPUT);
}

describe("starting a battle", () => {
  test("sends encounter with the fight to build: the arena, the enemy, the player's vitals, stats and burden", () => {
    const { session, link } = startSession({ dev: true, saved: { vitals: { ...HURT } } });
    session.debugEncounter();
    const msg = link.last("encounter");
    assert.equal(msg.source, null);
    assert.equal(msg.seat, 0);
    assert.deepEqual(msg.setup.arena, LEVEL.arena);
    const seed = msg.setup.enemies[0]?.seed;
    assert.deepEqual(msg.setup.enemies, [{ def: ENEMIES["wild-boar"], at: ENEMY_START, yaw: ENEMY_START_YAW, seed }]);
    assert.ok(Number.isInteger(seed) && seed! >= 0 && seed! < 2 ** 32, "a seed for its random numbers");
    assert.deepEqual(msg.setup.players, [{
      at: PLAYER_START, vitals: HURT, stats: session.stats, burden: "light", wields: { sword: true, spellbook: true },
    }]);
  });

  test("says what the player has in hand: no sword or spellbook there, no swinging or casting", () => {
    const bookOnly: Equipment = { ...starterEquipment(), rightHand: null };
    const { session, link } = startSession({ dev: true, saved: { equipment: bookOnly } });
    session.debugEncounter();
    assert.deepEqual(link.last("encounter").setup.players[0]!.wields, { sword: false, spellbook: true });
  });

  test("says how weighed down the player comes in (the fight applies it)", () => {
    const tusk = ITEMS["boar-tusk"];
    const count = carryLimit(PLAYER_STATS) / tusk.weight + 1;
    const heavy: Bag = {
      cols: count, rows: tusk.rows,
      items: Array.from({ length: count }, (_, x) => ({ item: "boar-tusk", count: 1, x, y: 0, turned: false })),
    };
    const { session, link } = startSession({ dev: true, saved: { bag: heavy } });
    session.debugEncounter();
    assert.equal(link.last("encounter").setup.players[0]!.burden, "heavy");
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

describe("the server runs the fight", () => {
  test("and decides a win from the player's inputs alone: result, loot packed, saved", (t) => {
    t.mock.method(Math, "random", () => 0);
    const { session, link, saves } = inBattle();
    win(session);
    const result = link.last("battleResult");
    assert.equal(result.won, true);
    assert.equal(result.wins, 1);
    assert.ok((result.loot["boar-meat"] ?? 0) >= 1);
    assert.deepEqual(result.leftBehind, {});
    assert.deepEqual(result.lost, {});
    assert.deepEqual(result.gear.bag, packLoot(emptyBag(), result.loot).bag);
    assert.deepEqual(session.bag, result.gear.bag);
    assert.equal(saves.length, 1);
    assert.equal(saves[0]?.wins, 1);
    assert.deepEqual(saves[0]?.bag, result.gear.bag);
  });

  test("a win keeps the HP and stamina the fight left, and the player where they were", () => {
    const { session, link } = inBattle();
    const before = session.overworld.playerPos();
    win(session);
    const last = link.last("battleSync").fight.players[0]!;
    assert.deepEqual(session.vitals, { hp: last.health.hp, stamina: last.stamina.value });
    assert.deepEqual(link.last("battleResult").vitals, session.vitals);
    assert.deepEqual(session.overworld.playerPos(), before);
  });

  test("checks the client's copy with a hash of the fight 4 times a second, and sends no states", () => {
    const { session, link } = inBattle();
    play(session, () => IDLE_INPUT, 60);
    assert.equal(link.all("battleHash").length, 60 / HASH_EVERY_STEPS);
    assert.equal(link.all("battleSync").length, 0);
  });

  test("nothing a client sends can end it: leaving the arena early is ignored, the fight goes on", () => {
    const { session, link } = inBattle(CARRIED);
    play(session, () => IDLE_INPUT, 30);
    session.leaveBattle();
    session.battleResync();
    session.battleInput(31, [{ step: 31, ...IDLE_INPUT, attack: "lr" }]);
    play(session, () => IDLE_INPUT, 30);
    assert.equal(link.all("battleResult").length, 0);
    assert.equal(fightOf(session).outcome.state, "fighting");
    assert.deepEqual(session.bag, CARRIED);
  });

  test("a loss (the boar wins) empties the bag for good, refills HP, wakes the player at the start, and saves", () => {
    const { session, link, saves } = inBattle(CARRIED, { hp: 1, stamina: 40 });
    session.overworld.place({ x: 3, z: 3 });
    play(session, () => IDLE_INPUT);
    const result = link.last("battleResult");
    assert.equal(result.won, false);
    assert.equal(link.last("battleSync").fight.players[0]!.health.hp, 0, "the boar hit them");
    assert.deepEqual(result.lost, { "boar-meat": 2, "boar-tusk": 1 });
    assert.deepEqual(result.gear.bag, { ...CARRIED, items: [] });
    assert.deepEqual(session.bag, result.gear.bag);
    assert.deepEqual(result.vitals, FULL);
    assert.deepEqual(result.me, LEVEL.spawn);
    assert.equal(result.wins, 0);
    assert.equal(saves.length, 1);
    assert.deepEqual(saves[0]?.bag, result.gear.bag);
  });

  test("after a death the player wakes with a fresh sword and spellbook in hand, whatever they had", () => {
    const swapped: Equipment = { ...starterEquipment(), rightHand: null, leftHand: "sword" };
    const started = startSession({ dev: true, saved: { vitals: { hp: 1, stamina: 40 }, equipment: swapped } });
    const { session, link, saves } = started;
    session.debugEncounter();
    session.overworld.place({ x: 3, z: 3 });
    play(session, () => IDLE_INPUT);
    assert.equal(link.last("battleResult").won, false);
    assert.deepEqual(link.last("battleResult").gear.equipment, starterEquipment());
    assert.deepEqual(session.gear.equipment, starterEquipment());
    assert.deepEqual(saves.at(-1)?.equipment, starterEquipment());
  });

  test("a fight still going after MAX_FIGHT_TIME is lost: the bag empties", () => {
    const { session, link } = inBattle(CARRIED);
    play(session, () => IDLE_INPUT, 1);
    fightOf(session).outcome.stateTime = MAX_FIGHT_TIME;
    play(session, () => IDLE_INPUT, 1);
    assert.equal(link.last("battleResult").won, false);
    assert.deepEqual(session.bag.items, []);
  });

  test("a player who disconnects mid-fight has lost it: the bag empties as on a death, and that's saved", () => {
    const { session, saves } = inBattle(CARRIED);
    play(session, () => IDLE_INPUT, 30);
    const room = session.battle!.room;
    session.disconnect();
    assert.equal(room.over, true, "the fight is freed");
    const saved = saves.at(-1);
    assert.deepEqual(saved?.bag.items, []);
    assert.deepEqual(saved?.vitals, FULL);
  });

  test("disconnecting after the result changes nothing more", () => {
    const { session, saves } = inBattle(CARRIED);
    win(session);
    const bag = session.bag;
    session.disconnect();
    assert.deepEqual(saves.at(-1)?.bag, bag);
    assert.equal(saves.at(-1)?.wins, 1);
  });
});

describe("casting spells", () => {
  const NOVA: Spell = { segments: [{ form: "nova", elements: ["fire"], augments: [] }] };
  function startsCasting(knownWords: Word[]): boolean {
    const { session } = startSession({ dev: true, saved: { knownWords } });
    session.debugEncounter();
    play(session, () => IDLE_INPUT, 2);
    play(session, () => ({ ...IDLE_INPUT, cast: NOVA }), 1);
    play(session, () => IDLE_INPUT, 1);
    return fightOf(session).world.require(fightOf(session).players[0]!, Player).action === "cast";
  }

  test("a spell the player knows every word of is cast", () => {
    assert.equal(startsCasting(["nova", "fire"]), true);
  });

  test("one with a word they don't know isn't", () => {
    assert.equal(startsCasting(["nova"]), false);
    assert.equal(startsCasting([]), false);
  });
});

describe("leaving the arena", () => {
  test("after the result, the player stays in the arena (no overworld) until they leave it", () => {
    const { session, link } = inBattle();
    lose(session);
    const sent = link.sent.length;
    for (let i = 0; i < 10; i++) session.tick(FIXED_DT);
    assert.equal(link.sent.length, sent);
    session.leaveBattle();
    assert.equal(session.battle, null);
    for (let i = 0; i < 3; i++) session.tick(FIXED_DT);
    assert.equal(link.all("state").length, 1, "the overworld goes on");
  });
});

describe("the overworld after a battle", () => {
  function touchBoar() {
    const started = startSession();
    const found = findBoar(started.session);
    started.session.overworld.place(found.pos);
    started.session.tick(FIXED_DT);
    return { ...started, ...found };
  }

  test("winning against the overworld boar removes it", () => {
    const { session, boar } = touchBoar();
    win(session);
    assert.equal(session.overworld.world.isAlive(boar), false);
  });

  test("losing leaves the overworld boar in place", () => {
    const { session, boar } = touchBoar();
    lose(session);
    session.leaveBattle();
    assert.equal(session.overworld.world.isAlive(boar), true);
  });

  test("the level's safe time blocks a new encounter right away, and only for that long", () => {
    const { session, link } = touchBoar();
    lose(session);
    session.leaveBattle();

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

const MEAT_STACK = ITEMS["boar-meat"].stackSize;

describe("packLoot", () => {
  test("puts everything in the bag when there's room", () => {
    const { bag, left } = packLoot(emptyBag(), { "boar-meat": 2, "boar-tusk": 1 });
    assert.deepEqual(left, {});
    assert.deepEqual(bag.items.map((s) => [s.item, s.count]), [["boar-meat", 2], ["boar-tusk", 1]]);
  });

  test("what doesn't fit is left behind, by item", () => {
    const tiny: Bag = { cols: 1, rows: 1, items: [] };
    const { bag, left } = packLoot(tiny, { "boar-meat": MEAT_STACK + 1, "boar-hide": 1 });
    assert.deepEqual(left, { "boar-meat": 1, "boar-hide": 1 });
    assert.deepEqual(bag.items.map((s) => [s.item, s.count]), [["boar-meat", MEAT_STACK]]);
  });

  test("no loot leaves the bag as it was", () => {
    const start = emptyBag();
    assert.deepEqual(packLoot(start, {}), { bag: start, left: {} });
  });
});
