import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  addItem, bagCounts, emptyBag, FIXED_DT, Health, IDLE_INPUT, Player, Stamina, type ItemCounts,
} from "@infinite-tower/shared";
import { initPhysics, type Fight } from "@infinite-tower/shared/fight";
import { fullVitals, PLAYER_STATS } from "../../../src/core/content/player.js";
import type { GameSession } from "../../../src/core/game/session.js";
import { startSession } from "./helpers.js";

before(() => initPhysics());

const FULL = fullVitals(PLAYER_STATS);
const HURT = { hp: 10, stamina: 3 };
/** Long enough for the boar to charge and bite a player standing still, more than once. */
const IDLE_TIME = 12;

const fightOf = (session: GameSession): Fight => {
  const room = session.battle?.room;
  if (!room) throw new Error("not in a battle");
  return room.fight;
};
const myHp = (session: GameSession) => fightOf(session).world.require(fightOf(session).players[0]!, Health).hp;

function standStill(session: GameSession, seconds: number): void {
  const fight = fightOf(session);
  for (let i = 0; i < seconds / FIXED_DT && session.battle && !session.battle.over; i++) {
    const step = fight.steps + 1;
    session.battleInput(step, [{ step, ...IDLE_INPUT }]);
    session.tick(FIXED_DT);
  }
}

const fightBoar = (session: GameSession) => session.cheat({ kind: "encounter", enemy: "wild-boar" });

describe("on a production server", () => {
  test("every cheat is ignored", () => {
    const { session, link, saves } = startSession({ dev: false, saved: { vitals: { ...HURT } } });
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    session.cheat({ kind: "invulnerable", on: true });
    session.cheat({ kind: "give", item: "boar-meat", count: 3 });
    session.cheat({ kind: "heal" });
    assert.equal(session.battle, null);
    assert.deepEqual(session.vitals, HURT);
    assert.deepEqual(session.bag, emptyBag());
    assert.equal(saves.length, 0);
    assert.deepEqual(link.sent.map((m) => m.t).filter((t) => t !== "welcome" && t !== "level"), []);
  });
});

describe("encounter", () => {
  test("starts a battle against the enemy asked for", () => {
    const { session, link } = startSession({ dev: true });
    session.cheat({ kind: "encounter", enemy: "kobold-swordsman" });
    assert.ok(session.battle);
    assert.equal(link.last("encounter").setup.enemies[0]?.def.id, "kobold-swordsman");
  });

  test("does nothing mid-battle, or before the player has a level", () => {
    const inFight = startSession({ dev: true });
    fightBoar(inFight.session);
    fightBoar(inFight.session);
    assert.equal(inFight.link.all("encounter").length, 1);
    const making = startSession({ dev: true, saved: { character: null } });
    fightBoar(making.session);
    assert.equal(making.link.all("encounter").length, 0);
  });
});

describe("invulnerable", () => {
  test("is said back, isn't saved, and goes into the next fight", () => {
    const { session, link, saves } = startSession({ dev: true });
    session.cheat({ kind: "invulnerable", on: true });
    assert.equal(link.last("invulnerable").on, true);
    assert.equal(saves.length, 0);
    fightBoar(session);
    assert.equal(link.last("encounter").setup.players[0]?.invulnerable, true);
  });

  test("a fight with it on: the boar does no damage", () => {
    const control = startSession({ dev: true });
    fightBoar(control.session);
    standStill(control.session, IDLE_TIME);
    assert.ok(myHp(control.session) < FULL.hp, "the boar hurts a player without it");

    const { session } = startSession({ dev: true });
    session.cheat({ kind: "invulnerable", on: true });
    fightBoar(session);
    standStill(session, IDLE_TIME);
    assert.equal(myHp(session), FULL.hp);
  });

  test("turned on mid-fight: the fight's player has it at once, and the client gets the fight", () => {
    const { session, link } = startSession({ dev: true });
    fightBoar(session);
    standStill(session, 0.5);
    const syncs = link.all("battleSync").length;
    session.cheat({ kind: "invulnerable", on: true });
    const fight = fightOf(session);
    assert.equal(fight.world.require(fight.players[0]!, Player).invulnerable, true);
    assert.equal(link.all("battleSync").length, syncs + 1);
    assert.equal(link.last("battleSync").fight.players[0]?.player.invulnerable, true);
    const hp = myHp(session);
    standStill(session, IDLE_TIME);
    assert.equal(myHp(session), hp);
  });
});

describe("give", () => {
  test("packs the items into the bag, saves, and says what was given", () => {
    const { session, link, saves } = startSession({ dev: true });
    session.cheat({ kind: "give", item: "boar-meat", count: 7 });
    assert.deepEqual(bagCounts(session.bag), { "boar-meat": 7 });
    assert.deepEqual(saves.at(-1)?.bag, session.bag);
    const given = link.last("given");
    assert.deepEqual([given.item, given.count, given.left], ["boar-meat", 7, 0]);
    assert.deepEqual(given.gear, session.gear);
  });

  test("a full bag keeps what fits and says how many were left out", () => {
    const { session, link } = startSession({ dev: true });
    const fits = addItem(emptyBag(), "boar-hide", 1000).bag;
    const fitCount = (bagCounts(fits) as ItemCounts)["boar-hide"] ?? 0;
    session.cheat({ kind: "give", item: "boar-hide", count: fitCount + 3 });
    assert.deepEqual(bagCounts(session.bag), { "boar-hide": fitCount });
    const given = link.last("given");
    assert.deepEqual([given.count, given.left], [fitCount, 3]);
  });

  test("does nothing in a battle: the fight has the bag", () => {
    const { session, link } = startSession({ dev: true });
    fightBoar(session);
    session.cheat({ kind: "give", item: "boar-meat", count: 1 });
    assert.equal(link.all("given").length, 0);
    assert.deepEqual(session.bag, emptyBag());
  });
});

describe("heal", () => {
  test("refills HP and stamina anywhere, saves, and says so", () => {
    const { session, link, saves } = startSession({ dev: true, saved: { vitals: { ...HURT } } });
    session.cheat({ kind: "heal" });
    assert.deepEqual(session.vitals, FULL);
    assert.deepEqual(saves.at(-1)?.vitals, FULL);
    assert.deepEqual(link.last("healed").vitals, FULL);
  });

  test("in a fight refills the fight's HP and stamina, and the client gets the fight", () => {
    const { session, link } = startSession({ dev: true, saved: { vitals: { ...HURT } } });
    fightBoar(session);
    standStill(session, 0.2);
    session.cheat({ kind: "heal" });
    const fight = fightOf(session), me = fight.players[0]!;
    assert.equal(fight.world.require(me, Health).hp, FULL.hp);
    assert.equal(fight.world.require(me, Stamina).value, fight.world.require(me, Stamina).max);
    assert.equal(link.last("battleSync").fight.players[0]?.health.hp, FULL.hp);
  });
});
