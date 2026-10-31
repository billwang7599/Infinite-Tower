import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  AVERAGE_STAT, blankSkillbook, BURDEN, carryLimit, emptyBag, emptyCloth, FIXED_DT, ITEMS, Player, REST_RANGE_TILES,
  starterEquipment, useSteps, WEAPONS, WORDS, type Bag, type BagItem, type Equipment, type GridName, type ItemId,
  type Skill,
} from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { fullVitals, PLAYER_STATS } from "../../../src/core/content/player.js";
import { getLevel, START_LEVEL } from "../../../src/core/world/index.js";
import { near, regenOver, startSession, tick } from "./helpers.js";

before(() => initPhysics());

const FULL = fullVitals(PLAYER_STATS);
const MEAT_HEAL_HP = ITEMS["boar-meat"].consumable.effects[0].healShare * FULL.hp;
const campfire = () => {
  const fire = getLevel(START_LEVEL).layout.campfires[0];
  if (!fire) throw new Error("the start level has no campfire");
  return fire;
};

describe("input", () => {
  test("is queued while walking the overworld", () => {
    const { session } = startSession();
    session.input(1, 1, 0);
    assert.equal(session.overworld.playerData(session.me).queue.length, 1);
  });

  test("is ignored during a battle", () => {
    const { session } = startSession({ dev: true });
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    session.input(1, 1, 0);
    assert.equal(session.overworld.playerData(session.me).queue.length, 0);
  });
});

describe("settings", () => {
  test("a burst of changes is saved once, after the debounce, with the latest settings", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { session, saves } = startSession();
    session.setSettings({ camera: { sensitivity: 1.5 } });
    session.setSettings({ camera: { sensitivity: 2 } });
    t.mock.timers.tick(10);
    assert.equal(saves.length, 0);
    t.mock.timers.tick(5000);
    assert.equal(saves.length, 1);
    assert.deepEqual(saves[0]?.settings, { camera: { sensitivity: 2 } });
  });

  test("saving (leaving) writes pending settings at once, and the debounce doesn't save again", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { session, saves } = startSession();
    session.setSettings({ camera: { sensitivity: 0.5 } });
    session.save();
    assert.equal(saves.length, 1);
    assert.deepEqual(saves[0]?.settings, { camera: { sensitivity: 0.5 } });
    t.mock.timers.tick(5000);
    assert.equal(saves.length, 1);
  });
});

describe("rest", () => {
  test("by a campfire refills HP and stamina, saves, and sends rested", () => {
    const { session, link, saves } = startSession({ saved: { vitals: { hp: 10, stamina: 3 } } });
    session.overworld.place(session.me, campfire());
    session.rest();
    assert.deepEqual(session.vitals, FULL);
    assert.equal(saves.length, 1);
    assert.deepEqual(saves[0]?.vitals, FULL);
    assert.deepEqual(link.last("rested").vitals, FULL);
  });

  test("works anywhere within reach of the fire", () => {
    const fire = campfire();
    const { session, link } = startSession({ saved: { vitals: { hp: 10, stamina: 3 } } });
    session.overworld.place(session.me, { x: fire.x + REST_RANGE_TILES * 0.9, z: fire.z });
    session.rest();
    assert.deepEqual(link.last("rested").vitals, FULL);
  });

  test("away from the fire does nothing", () => {
    const fire = campfire();
    const { session, link, saves } = startSession({ saved: { vitals: { hp: 10, stamina: 3 } } });
    session.overworld.place(session.me, { x: fire.x + REST_RANGE_TILES + 1, z: fire.z });
    session.rest();
    assert.deepEqual(session.vitals, { hp: 10, stamina: 3 });
    assert.equal(saves.length, 0);
    assert.equal(link.all("rested").length, 0);
  });

  test("at full vitals still sends rested but doesn't save", () => {
    const { session, link, saves } = startSession();
    session.overworld.place(session.me, campfire());
    session.rest();
    assert.deepEqual(link.last("rested").vitals, FULL);
    assert.equal(saves.length, 0);
  });

  test("does nothing during a battle", () => {
    const { session, link } = startSession({ dev: true, saved: { vitals: { hp: 10, stamina: 3 } } });
    session.overworld.place(session.me, campfire());
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    session.rest();
    assert.equal(link.all("rested").length, 0);
    assert.deepEqual(session.vitals, { hp: 10, stamina: 3 });
  });
});

const NOTHING_WORN: Equipment = { rightHand: null, leftHand: null, head: null, body: null, legs: null, boots: null };
const spot = <G extends GridName>(grid: G, x: number, y: number) => ({ in: grid, x, y });
const bagSpot = (x: number, y: number) => spot("bag", x, y);

/** A bag holding `items`, each `[item, count, x, y]`, lying flat. */
const bagOf = (...items: [ItemId, number, number, number][]): Bag =>
  ({ ...emptyBag(), items: items.map(([item, count, x, y]) => ({ item, count, x, y, turned: false })) });

describe("eating (useItem)", () => {
  const MEAT_CELL = bagSpot(2, 1);
  const EAT_TICKS = useSteps("boar-meat");
  const hungry = (hp: number, count = 2, dev = false) =>
    startSession({ dev, saved: { vitals: { hp, stamina: 20 }, bag: bagOf(["boar-meat", count, 2, 1]) } });

  test("takes its useTime: the meat is used up and heals at the end, then it's saved and itemUsed sent", () => {
    const hp = FULL.hp - MEAT_HEAL_HP - 5;
    const { session, link, saves } = hungry(hp);
    session.useItem(MEAT_CELL);
    assert.deepEqual(link.last("using"), { t: "using", at: MEAT_CELL });
    tick(session, EAT_TICKS - 1);
    near(session.vitals.hp, hp + regenOver(EAT_TICKS - 1), "not yet, but some comes back on its own");
    assert.deepEqual(session.bag, bagOf(["boar-meat", 2, 2, 1]));
    assert.equal(link.all("itemUsed").length, 0);
    tick(session);
    near(session.vitals.hp, hp + regenOver(EAT_TICKS) + MEAT_HEAL_HP);
    assert.equal(session.vitals.stamina, 20);
    assert.deepEqual(session.bag, bagOf(["boar-meat", 1, 2, 1]));
    assert.equal(saves.length, 1);
    assert.deepEqual(link.last("itemUsed"), {
      t: "itemUsed", item: "boar-meat", vitals: session.vitals, gear: session.gear,
    });
  });

  test("healing is capped at max HP, and the last one leaves the cell empty", () => {
    const { session } = hungry(FULL.hp - 1, 1);
    session.useItem(MEAT_CELL);
    tick(session, EAT_TICKS);
    assert.equal(session.vitals.hp, FULL.hp);
    assert.deepEqual(session.bag, emptyBag());
  });

  test("doesn't start at full HP", () => {
    const { session, link, saves } = startSession({ saved: { bag: bagOf(["boar-meat", 1, 2, 1]) } });
    session.useItem(MEAT_CELL);
    tick(session, EAT_TICKS);
    assert.deepEqual(session.bag, bagOf(["boar-meat", 1, 2, 1]));
    assert.equal(saves.length, 0);
    assert.equal(link.all("using").length + link.all("itemUsed").length, 0);
  });

  test("doesn't start on an empty cell, or an item that can't be used", () => {
    const { session, link } = startSession({
      saved: { vitals: { hp: 10, stamina: 20 }, bag: bagOf(["boar-tusk", 1, 0, 0]) },
    });
    session.useItem(MEAT_CELL);
    session.useItem(bagSpot(0, 1));
    tick(session, EAT_TICKS);
    near(session.vitals.hp, 10 + regenOver(EAT_TICKS));
    assert.deepEqual(session.bag, bagOf(["boar-tusk", 1, 0, 0]));
    assert.equal(link.all("using").length + link.all("itemUsed").length, 0);
  });

  test("closing the bag stops it: nothing healed, the meat kept, and the client told", () => {
    const { session, link } = hungry(10);
    session.useItem(MEAT_CELL);
    tick(session, EAT_TICKS / 2);
    session.closeBag();
    assert.deepEqual(link.last("using"), { t: "using", at: null });
    tick(session, EAT_TICKS);
    near(session.vitals.hp, 10 + regenOver(EAT_TICKS / 2 + EAT_TICKS));
    assert.deepEqual(session.bag, bagOf(["boar-meat", 2, 2, 1]));
    assert.equal(link.all("itemUsed").length, 0);
  });

  test("walking stops it", () => {
    const { session } = hungry(10);
    session.useItem(MEAT_CELL);
    tick(session, EAT_TICKS / 2);
    session.input(1, 1, 0);
    tick(session, EAT_TICKS);
    near(session.vitals.hp, 10 + regenOver(EAT_TICKS / 2 + EAT_TICKS));
    assert.deepEqual(session.bag, bagOf(["boar-meat", 2, 2, 1]));
  });

  test("a fight starting stops it, the meat taken into the fight uneaten", () => {
    const { session, link } = hungry(10, 2, true);
    session.useItem(MEAT_CELL);
    tick(session, EAT_TICKS / 2);
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    assert.deepEqual(link.last("using"), { t: "using", at: null });
    const fight = session.battle!.room.fight;
    assert.deepEqual(fight.world.require(fight.players[0]!, Player).gear.bag, bagOf(["boar-meat", 2, 2, 1]));
  });

  test("one at a time: using another while eating does nothing", () => {
    const { session } = hungry(10);
    session.useItem(MEAT_CELL);
    tick(session, EAT_TICKS / 2);
    session.useItem(MEAT_CELL);
    tick(session, EAT_TICKS);
    near(session.vitals.hp, 10 + MEAT_HEAL_HP + regenOver(EAT_TICKS / 2 + EAT_TICKS));
    assert.deepEqual(session.bag, bagOf(["boar-meat", 1, 2, 1]));
  });

  test("nothing in the bag moves while eating", () => {
    const { session, link } = hungry(10);
    session.useItem(MEAT_CELL);
    session.moveItem(MEAT_CELL, bagSpot(0, 0), false);
    assert.deepEqual(session.bag, bagOf(["boar-meat", 2, 2, 1]));
    assert.deepEqual(link.last("gear").gear, session.gear);
  });
});

describe("moveItem", () => {
  test("moves an item, sends the gear back, and saves it soon after", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { session, link, saves } = startSession({ saved: { bag: bagOf(["boar-hide", 1, 0, 0]) } });
    session.moveItem(bagSpot(1, 1), bagSpot(3, 2), false);
    assert.deepEqual(session.bag, bagOf(["boar-hide", 1, 3, 2]));
    assert.deepEqual(link.last("gear"), { t: "gear", gear: session.gear });
    assert.equal(saves.length, 0);
    t.mock.timers.tick(5000);
    assert.equal(saves.length, 1);
    assert.deepEqual(saves[0]?.bag, session.bag);
  });

  test("a move that doesn't fit changes nothing, and sends the gear back as it is", () => {
    const start = bagOf(["boar-hide", 1, 0, 0], ["boar-tusk", 1, 2, 0]);
    const { session, link } = startSession({ saved: { bag: start } });
    session.moveItem(bagSpot(0, 0), bagSpot(1, 0), false);
    assert.deepEqual(session.bag, start);
    assert.deepEqual(link.last("gear")?.gear.bag, start);
  });

  test("does nothing during a battle", () => {
    const start = bagOf(["boar-hide", 1, 0, 0]);
    const { session, link } = startSession({ dev: true, saved: { bag: start } });
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    session.moveItem(bagSpot(0, 0), bagSpot(3, 2), false);
    session.moveItem({ in: "slot", slot: "rightHand" }, bagSpot(3, 2), false);
    assert.deepEqual(session.bag, start);
    assert.deepEqual(session.gear.equipment, starterEquipment());
    assert.equal(link.all("gear").length, 0);
  });
});

describe("equipment", () => {
  test("a new player has the sword and the skillbook in hand, and the welcome says so", () => {
    const { session, link } = startSession();
    assert.deepEqual(session.gear.equipment, starterEquipment());
    assert.deepEqual(link.last("welcome")?.gear.equipment, starterEquipment());
  });

  test("taking the sword off puts it in the bag, and the save has it there", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { session, saves } = startSession();
    session.moveItem({ in: "slot", slot: "rightHand" }, bagSpot(0, 0), false);
    assert.equal(session.gear.equipment.rightHand, null);
    assert.equal(session.bag.items[0]?.item, "sword");
    t.mock.timers.tick(5000);
    assert.equal(saves.at(-1)?.equipment.rightHand, null);
    assert.equal(saves.at(-1)?.bag.items[0]?.item, "sword");
  });

  test("a weapon goes into a hand only with its minimum strength; the server answers with the gear as it is", () => {
    const need = WEAPONS.greatsword.minStrength;
    for (const [strength, held] of [[need - 1, null], [need, "greatsword"]] as const) {
      const core = { steps: 0, fill: 0, points: { strength: strength - AVERAGE_STAT } };
      const equipment = { ...starterEquipment(), rightHand: null };
      const bag = { ...emptyBag(), items: [{ item: "greatsword" as const, count: 1, x: 0, y: 0, turned: false }] };
      const { session, link } = startSession({ saved: { core, equipment, bag } });
      assert.equal(session.stats.strength, strength);
      session.moveItem(bagSpot(0, 0), { in: "slot", slot: "rightHand" }, false);
      assert.equal(session.gear.equipment.rightHand, held, `${strength}`);
      assert.deepEqual(link.last("gear")?.gear, session.gear);
    }
  });

  test("what's worn weighs on you: a bag at the limit with the sword in hand is heavy", () => {
    const limit = carryLimit(PLAYER_STATS);
    const tusks = Math.ceil(limit / ITEMS["boar-tusk"].weight);
    const atLimit: Bag = {
      cols: tusks, rows: 2,
      items: Array.from({ length: tusks }, (_, x) => ({ item: "boar-tusk", count: 1, x, y: 0, turned: false })),
    };
    assert.equal(startSession({ saved: { bag: atLimit, equipment: NOTHING_WORN } }).session.burden, "light");
    assert.equal(startSession({ saved: { bag: atLimit } }).session.burden, "heavy");
  });
});

describe("the cloth", () => {
  const onCloth = () => {
    const started = startSession({ saved: { bag: bagOf(["boar-tusk", 1, 0, 0], ["boar-meat", 3, 2, 0]) } });
    started.session.moveItem(bagSpot(0, 0), spot("cloth", 1, 1), false);
    return started;
  };

  test("an item put on it leaves the bag and weighs nothing", () => {
    const { session } = onCloth();
    assert.deepEqual(session.gear.cloth.items, [{ item: "boar-tusk", count: 1, x: 1, y: 1, turned: false }]);
    assert.deepEqual(session.bag, bagOf(["boar-meat", 3, 2, 0]));
  });

  test("it can be taken back off into the bag", () => {
    const { session } = onCloth();
    session.moveItem(spot("cloth", 1, 2), bagSpot(5, 0), false);
    assert.deepEqual(session.gear.cloth.items, []);
    assert.deepEqual(session.bag, bagOf(["boar-meat", 3, 2, 0], ["boar-tusk", 1, 5, 0]));
  });

  test("closing the bag loses what's left on it, and says so", () => {
    const { session, link } = onCloth();
    session.closeBag();
    assert.deepEqual(session.gear.cloth, emptyCloth());
    assert.deepEqual(session.bag, bagOf(["boar-meat", 3, 2, 0]));
    assert.deepEqual(link.last("gear"), { t: "gear", gear: session.gear });
  });

  test("it isn't saved: on a disconnect what's on it is gone", () => {
    const { session, saves } = onCloth();
    session.disconnect();
    assert.deepEqual(saves.at(-1)?.bag, bagOf(["boar-meat", 3, 2, 0]));
    assert.equal("cloth" in saves.at(-1)!, false);
  });

  test("walking away (the bag is closed) leaves it behind too", () => {
    const { session, link } = onCloth();
    session.input(1, 0, 0);
    assert.equal(session.gear.cloth.items.length, 1, "standing still keeps it");
    session.input(2, 1, 0);
    assert.deepEqual(session.gear.cloth, emptyCloth());
    assert.deepEqual(link.last("gear")?.gear.cloth, emptyCloth());
  });

  test("a fight starting leaves it behind", () => {
    const started = startSession({ dev: true, saved: { bag: bagOf(["boar-tusk", 1, 0, 0]) } });
    started.session.moveItem(bagSpot(0, 0), spot("cloth", 0, 0), false);
    started.session.cheat({ kind: "encounter", enemy: "wild-boar" });
    assert.deepEqual(started.session.gear.cloth, emptyCloth());
  });
});

describe("carry weight", () => {
  const LIMIT = carryLimit(PLAYER_STATS);
  const FULL_STEP = getLevel(START_LEVEL).layout.playerSpeed * FIXED_DT;
  /** Just over the overloaded line, with a stack of meat on top: eating one drops it back under. */
  const tuskCount = Math.floor((LIMIT * BURDEN.overloadedAt) / ITEMS["boar-tusk"].weight);
  const meat = ITEMS["boar-meat"].stackSize;
  const tusks: BagItem[] = Array.from({ length: tuskCount }, (_, x) => ({
    item: "boar-tusk", count: 1, x, y: 0, turned: false,
  }));
  const OVERLOADED: Bag = {
    cols: tuskCount + 1, rows: 2,
    items: [...tusks, { item: "boar-meat", count: meat, x: tuskCount, y: 0, turned: false }],
  };
  const HEAVY: Bag = { cols: tuskCount, rows: 2, items: tusks };

  let seq = 0;
  /** How far one tick of walking right takes the player on the server. */
  function stepRight(session: ReturnType<typeof startSession>["session"]): number {
    const from = session.overworld.playerPos(session.me);
    session.input(++seq, 1, 0);
    tick(session);
    return session.overworld.playerPos(session.me).x - from.x;
  }
  const close = (actual: number, expected: number) =>
    assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≉ ${expected}`);

  test("overloaded, the player walks the overworld at half speed", () => {
    const { session } = startSession({ saved: { bag: OVERLOADED, equipment: NOTHING_WORN } });
    close(stepRight(session), FULL_STEP * BURDEN.overloadedPace);
  });

  test("heavy (over the limit but not overloaded), walking is full speed", () => {
    const { session } = startSession({ saved: { bag: HEAVY, equipment: NOTHING_WORN } });
    close(stepRight(session), FULL_STEP);
  });

  test("eating back under the line restores full speed once it's eaten", () => {
    const { session } = startSession({
      saved: { vitals: { hp: 10, stamina: 20 }, bag: OVERLOADED, equipment: NOTHING_WORN },
    });
    session.useItem(bagSpot(tuskCount, 0));
    tick(session, useSteps("boar-meat"));
    close(stepRight(session), FULL_STEP);
  });
});

describe("the skillbook", () => {
  const FIREBOLT: Skill = { segments: [{ form: "bolt", elements: ["fire"], modifiers: [] }] };
  const knowing = () => startSession({ dev: true, saved: { knownWords: [...WORDS] } });

  test("the welcome has the words the player knows and the book's pages, blank for a new player", () => {
    const { link } = startSession({ saved: { knownWords: ["bolt", "fire"] } });
    const welcome = link.last("welcome");
    assert.deepEqual(welcome.knownWords, ["bolt", "fire"]);
    assert.deepEqual(welcome.skillbook, blankSkillbook());
  });

  test("writing a skill on a page sends the book back and saves it soon after", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { session, link, saves } = knowing();
    session.saveSkill(2, FIREBOLT);
    assert.deepEqual(link.last("skillbook").skillbook, [null, null, FIREBOLT, null]);
    t.mock.timers.tick(5000);
    assert.deepEqual(saves.at(-1)?.skillbook, [null, null, FIREBOLT, null]);
  });

  test("a page can be written over", () => {
    const { session, link } = knowing();
    const nova: Skill = { segments: [{ form: "nova", elements: ["water"], modifiers: [] }] };
    session.saveSkill(0, FIREBOLT);
    session.saveSkill(0, nova);
    assert.deepEqual(link.last("skillbook").skillbook[0], nova);
  });

  test("a skill with a word the player doesn't know isn't written: the book comes back as it was", () => {
    const { session, link } = startSession({ saved: { knownWords: ["bolt"] } });
    session.saveSkill(0, FIREBOLT);
    assert.deepEqual(link.last("skillbook").skillbook, blankSkillbook());
  });

  test("nothing is written without the skillbook in hand", () => {
    const { session, link } = startSession({ saved: { knownWords: [...WORDS], equipment: NOTHING_WORN } });
    session.saveSkill(0, FIREBOLT);
    assert.deepEqual(link.last("skillbook").skillbook, blankSkillbook());
  });

  test("not by a message during a battle: in a fight, writing is the fight's", () => {
    const { session, link } = knowing();
    session.cheat({ kind: "encounter", enemy: "wild-boar" });
    session.saveSkill(1, FIREBOLT);
    assert.deepEqual(session.skillbook, blankSkillbook());
    assert.deepEqual(link.last("skillbook").skillbook, blankSkillbook());
  });
});
