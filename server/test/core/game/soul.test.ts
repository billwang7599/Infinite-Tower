import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  absorb, CORE_STEPS, coreStats, emptyBag, fillToFinish, FIXED_DT, Health, hpRegenPerSec,
  IDLE_INPUT, ITEMS, maxHpOf, newCore, Player, pointsEarned, REST_RANGE_TILES, staminaMaxOf, useSteps, type Bag,
  type CoreState, type PlayerInputData, type UseSpot,
} from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { fullVitals } from "../../../src/core/content/player.js";
import type { GameSession } from "../../../src/core/game/session.js";
import { getRegion } from "../../../src/core/world/index.js";
import { HOLLOW, startSession, tick } from "./helpers.js";

before(() => initPhysics());

const WORTH = ITEMS["boar-essence"].consumable.effects[0].essence;
const ABSORB_TICKS = useSteps("boar-essence");
const CELL: UseSpot = { in: "bag", x: 0, y: 0 };
const essence = (count = 2): Bag =>
  ({ ...emptyBag(), items: [{ item: "boar-essence", count, x: CELL.x, y: CELL.y, turned: false }] });
const at = (steps: number, fill = 0, points: CoreState["points"] = {}): CoreState =>
  ({ steps, fill, points, inscriptions: [] });
const HURT = { hp: 50, stamina: 40 };
const campfire = () => getRegion(HOLLOW).campfires[0]!;
const holding = (core: CoreState, dev = false) =>
  startSession({ cheats: dev, saved: { core, bag: essence(), vitals: { ...HURT } } });

describe("the core on a session", () => {
  test("welcome carries the saved core; its stats are the session's", () => {
    const { session, link } = startSession({ saved: { core: at(2, 30, { strength: 1 }) } });
    assert.deepEqual(link.last("welcome").core, at(2, 30, { strength: 1 }));
    assert.deepEqual(session.stats, coreStats(at(2, 30, { strength: 1 })));
  });

  test("a fight's setup carries the core and the stats it gives", () => {
    const { session, link } = startSession({ cheats: true, saved: { core: at(4, 5) } });
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    const me = link.last("encounter").setup.players[0]!;
    assert.deepEqual(me.core, at(4, 5));
    assert.deepEqual(me.stats, coreStats(at(4, 5)));
  });

  test("saved with the player", () => {
    const { session, saves } = startSession({ saved: { core: at(1, 10) } });
    session.save();
    assert.deepEqual(saves.at(-1)?.core, at(1, 10));
  });
});

describe("absorbing essence on the overworld", () => {
  test("takes its useTime, fills the core, saves, and sends the core and itemUsed", () => {
    const { session, link, saves } = holding(newCore());
    session.useItem(CELL);
    tick(session, ABSORB_TICKS - 1);
    assert.deepEqual(session.core, newCore(), "not yet");
    tick(session);
    assert.deepEqual(session.core, absorb(newCore(), WORTH));
    assert.deepEqual(session.bag, essence(1));
    assert.deepEqual(saves.at(-1)?.core, session.core);
    assert.deepEqual(link.last("core"), { t: "core", core: session.core, vitals: session.vitals, brokeThrough: false });
    assert.equal(link.last("itemUsed").item, "boar-essence");
  });

  test("a breakthrough grows the stats, and HP and stamina by as much as their most", () => {
    const { session, link } = holding(at(0, fillToFinish(1) - WORTH));
    const hpBefore = session.vitals.hp;
    session.useItem(CELL);
    tick(session, ABSORB_TICKS);
    assert.equal(session.core.steps, 1);
    const grown = coreStats(session.core), start = coreStats(newCore());
    assert.deepEqual(session.stats, grown);
    assert.ok(session.vitals.hp >= hpBefore + maxHpOf(grown) - maxHpOf(start));
    assert.equal(session.vitals.stamina, HURT.stamina + staminaMaxOf(grown) - staminaMaxOf(start));
    assert.equal(link.last("core").brokeThrough, true);
  });

  test("not into a whole core", () => {
    const { session, link } = holding(at(CORE_STEPS));
    session.useItem(CELL);
    tick(session, ABSORB_TICKS);
    assert.deepEqual(session.bag, essence());
    assert.equal(link.all("using").length, 0);
  });
});

describe("free points", () => {
  test("placed one at a time while any are left; each sends the core, and it's saved", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { session, link, saves } = startSession({ saved: { core: at(1) } });
    for (let i = 0; i < pointsEarned(at(1)); i++) session.statPoint("vitality", true);
    assert.deepEqual(session.core.points, { vitality: pointsEarned(at(1)) });
    assert.deepEqual(link.last("core").core, session.core);
    session.statPoint("strength", true);
    assert.deepEqual(session.core.points, { vitality: pointsEarned(at(1)) }, "none left");
    t.mock.timers.tick(5000);
    assert.deepEqual(saves.at(-1)?.core, session.core);
  });

  test("the stats follow: more vitality, more HP to fill", () => {
    const { session } = startSession({ saved: { core: at(1), vitals: { ...HURT } } });
    session.statPoint("vitality", true);
    const before = coreStats(at(1)), grown = maxHpOf(session.stats) - maxHpOf(before);
    assert.equal(grown, maxHpOf({ ...before, vitality: before.vitality + 1 }) - maxHpOf(before));
    assert.ok(grown > 0);
    assert.equal(session.vitals.hp, HURT.hp + grown);
  });

  test("taken back only by a campfire", () => {
    const { session, link } = startSession({ saved: { core: at(1, 0, { strength: 1 }) } });
    session.statPoint("strength", false);
    assert.deepEqual(session.core.points, { strength: 1 }, "away from the fire");
    assert.deepEqual(link.last("core").core.points, { strength: 1 }, "told it's unchanged");
    const fire = campfire();
    session.overworld.place(session.me, { x: fire.x + REST_RANGE_TILES * 0.9, z: fire.z });
    session.statPoint("strength", false);
    assert.deepEqual(session.core.points, {});
  });

  test("not in a battle", () => {
    const { session } = startSession({ cheats: true, saved: { core: at(1) } });
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    session.statPoint("strength", true);
    assert.deepEqual(session.core.points, {});
  });
});

describe("HP regen on the overworld", () => {
  test("a hurt player's HP comes back on its own, and `state` says so", () => {
    const { session, link } = startSession({ saved: { vitals: { ...HURT } } });
    tick(session, 120);
    const regen = hpRegenPerSec(session.stats) * 120 * FIXED_DT;
    assert.ok(Math.abs(session.vitals.hp - (HURT.hp + regen)) < 1e-6, `${session.vitals.hp}`);
    assert.ok(Math.abs(link.last("state").hp - session.vitals.hp) < 0.01);
    assert.equal(session.vitals.stamina, HURT.stamina, "stamina doesn't come back out of fights");
  });

  test("not past the most", () => {
    const full = fullVitals(coreStats(newCore()));
    const { session } = startSession({ saved: { vitals: { hp: full.hp - 0.1, stamina: 0 } } });
    tick(session, 120);
    assert.equal(session.vitals.hp, full.hp);
  });
});

const fightOf = (session: GameSession) => session.battle!.room.fight;

function play(session: GameSession, next: (step: number) => PlayerInputData, steps: number): void {
  const fight = fightOf(session);
  for (let i = 0; i < steps && session.battle && !session.battle.over; i++) {
    const step = fight.steps + 1;
    session.battleInput(step, [{ step, ...next(i) }]);
    session.tick();
  }
}

function absorbInFight(session: GameSession): void {
  play(session, (i) => ({ ...IDLE_INPUT, bag: true, use: i === 1 ? CELL : null }), ABSORB_TICKS + 5);
}

function endFight(session: GameSession, won: boolean): void {
  const fight = fightOf(session);
  const who = won ? fight.enemies[0]! : fight.players[0]!;
  fight.world.require(who, Health).hp = 0;
  play(session, () => IDLE_INPUT, 10);
  assert.ok(session.battle?.over ?? true, "decided");
}

describe("the core in a fight", () => {
  test("essence absorbed mid-fight is kept after a win, a breakthrough with it", () => {
    const { session, link, saves } = holding(at(0, fillToFinish(1) - WORTH), true);
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    absorbInFight(session);
    endFight(session, true);
    assert.deepEqual(session.core, at(1, 0));
    assert.deepEqual(saves.at(-1)?.core, at(1, 0));
    assert.deepEqual(link.last("battleResult").core, at(1, 0));
    assert.equal(link.last("battleResult").coreLost, null);
  });

  test("in the arena after a win it's absorbed as on the overworld, and the fight's core follows", () => {
    const { session } = holding(at(0, fillToFinish(1) - WORTH), true);
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    endFight(session, true);
    assert.ok(session.afterFight);
    session.useItem(CELL);
    for (let i = 0; i <= ABSORB_TICKS; i++) {
      const step = fightOf(session).steps + 1;
      session.battleInput(step, [{ step, ...IDLE_INPUT }]);
      session.tick();
    }
    assert.deepEqual(session.core, at(1, 0));
    const fight = fightOf(session), me = fight.players[0]!;
    assert.deepEqual(fight.world.require(me, Player).core, at(1, 0));
    assert.equal(fight.world.require(me, Health).max, maxHpOf(coreStats(at(1))));
  });

  test("a death loses the step's fill, and the result says so", () => {
    const { session, link } = holding(at(2, 40), true);
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    endFight(session, false);
    assert.deepEqual(session.core, at(2, 0));
    assert.equal(link.last("battleResult").coreLost, "fill");
  });

  test("with the fill already empty, a whole step, and they wake rested by the smaller stats", () => {
    const { session, link } = holding(at(2, 0, { vitality: pointsEarned(at(2)) }), true);
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    endFight(session, false);
    assert.equal(session.core.steps, 1);
    assert.equal(link.last("battleResult").coreLost, "step");
    assert.deepEqual(session.vitals, fullVitals(coreStats(session.core)));
  });

  test("leaving mid-fight is a death for the core too", () => {
    const { session } = holding(at(1, 40), true);
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    play(session, () => IDLE_INPUT, 2);
    session.disconnect();
    assert.deepEqual(session.core, at(1, 0));
  });
});

describe("the admin's core steps", () => {
  test("a step added or taken away, the fill emptied, told and saved", () => {
    const { session, link, saves } = startSession({ cheats: true, saved: { core: at(1, 30), vitals: { ...HURT } } });
    session.cheat({ kind: "coreStep", add: true });
    assert.deepEqual(session.core, at(2));
    assert.deepEqual(link.last("core").core, at(2));
    assert.deepEqual(saves.at(-1)?.core, at(2));
    session.cheat({ kind: "coreStep", add: false });
    session.cheat({ kind: "coreStep", add: false });
    session.cheat({ kind: "coreStep", add: false });
    assert.deepEqual(session.core, at(0));
  });

  test("ignored in production", () => {
    const prod = startSession({ saved: { core: at(1) } });
    prod.session.cheat({ kind: "coreStep", add: true });
    assert.deepEqual(prod.session.core, at(1));
  });

  test("mid-fight the fight's core takes it, its stats with it; the client gets the fight, and a win keeps it", () => {
    const { session, link } = startSession({ cheats: true, saved: { core: at(1) } });
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    play(session, () => IDLE_INPUT, 2);
    session.cheat({ kind: "coreStep", add: true });
    assert.deepEqual(session.core, at(1), "the fight has the core until it ends");
    const fight = fightOf(session), me = fight.players[0]!;
    assert.deepEqual(fight.world.require(me, Player).core, at(2));
    assert.equal(fight.world.require(me, Health).max, maxHpOf(coreStats(at(2))));
    assert.deepEqual(link.last("battleSync").fight.players[0]!.player.core, at(2));
    endFight(session, true);
    assert.deepEqual(session.core, at(2));
  });

  test("in the arena after a win, as on the overworld, and the fight's core follows", () => {
    const { session, link } = startSession({ cheats: true, saved: { core: at(1) } });
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    endFight(session, true);
    assert.ok(session.afterFight);
    session.cheat({ kind: "coreStep", add: true });
    assert.deepEqual(session.core, at(2));
    assert.deepEqual(link.last("core").core, at(2));
    const fight = fightOf(session);
    assert.deepEqual(fight.world.require(fight.players[0]!, Player).core, at(2));
  });
});
