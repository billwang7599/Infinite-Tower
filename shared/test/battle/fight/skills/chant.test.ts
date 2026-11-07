import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  blankSkillbook, releaseTime, emptyBag, packFor, FIXED_DT, Health, Player, SAVE_IN_FIGHT_TIME, SkillObject, Skilled,
  type PlayerInputData, type Skill, type Vec3, type Word,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import {
  ARENA, BITER, bodyOf, dumpState, enemy, IDLE, input, player, run, segment, skill, STATUE, SWORDSMAN, armed,
} from "../fixtures.js";

await initPhysics();

const at = (x: number, z: number): Vec3 => ({ x, y: 0.05, z });
const BOLT_FIRE = skill(segment("bolt", ["fire"]));
const NOVA_WATER = skill(segment("nova", ["water"]));
const CHANT = input({ chant: true });
const NO_BOOK = { ...armed(), leftHand: null };
const BOOKLESS = { bag: emptyBag(), pack: packFor(null), quiver: packFor(null), equipment: NO_BOOK };

function alone(book = blankSkillbook()): Fight {
  return new Fight({ arena: ARENA, players: [player(at(0, -4), { book })], enemies: [enemy(STATUE, at(0, 6))] });
}
const playerOf = (fight: Fight) => fight.world.require(fight.players[0]!, Player);
const shots = (fight: Fight) => [...fight.world.query(SkillObject)].length;
const flatPos = (fight: Fight) => {
  const { x, z } = bodyOf(fight, fight.players[0]!).pos;
  return { x, z };
};

function stepWhile(fight: Fight, action: string, next: PlayerInputData, seconds = 3): void {
  for (let i = 0; i < seconds / FIXED_DT && playerOf(fight).action === action; i++) fight.step([next]);
}

describe("chanting", () => {
  test("the chant input opens the chant; while it's open the player can't move", () => {
    const fight = alone();
    run(fight, 0.3);
    fight.step([CHANT]);
    assert.equal(playerOf(fight).action, "chant");
    const before = flatPos(fight);
    run(fight, 0.5, () => input({ chant: true, moveX: 1 }));
    assert.equal(playerOf(fight).action, "chant");
    const after = flatPos(fight);
    assert.ok(Math.hypot(after.x - before.x, after.z - before.z) < 0.01, "stood still");
  });

  test("letting go of it closes the chant, and the player walks again", () => {
    const fight = alone();
    run(fight, 0.3);
    fight.step([CHANT]);
    fight.step([IDLE]);
    assert.equal(playerOf(fight).action, "none");
    const before = flatPos(fight);
    run(fight, 0.3, () => input({ moveX: 1 }));
    assert.ok(flatPos(fight).x - before.x > 0.3);
  });

  test("it needs no skillbook: chanted and released without one", () => {
    const fight = new Fight({
      arena: ARENA, players: [player(at(0, -4), { gear: BOOKLESS })],
      enemies: [enemy(STATUE, at(0, 6))],
    });
    run(fight, 0.3);
    fight.step([CHANT]);
    assert.equal(playerOf(fight).action, "chant");
    fight.step([input({ chant: true, cast: BOLT_FIRE })]);
    assert.equal(playerOf(fight).action, "cast");
    run(fight, releaseTime(BOLT_FIRE));
    assert.equal(shots(fight), 1);
  });

  test("a hit that stuns breaks it off, and it stays shut until the chant is asked for again", () => {
    const fight = new Fight({ arena: ARENA, players: [player(at(0, -1))], enemies: [enemy(BITER, at(0, 1.5))] });
    fight.step([CHANT]);
    assert.equal(playerOf(fight).action, "chant");
    stepWhile(fight, "chant", CHANT);
    assert.ok(fight.world.require(fight.players[0]!, Health).hp < 100, "bitten");
    run(fight, 1.5, () => CHANT);
    assert.notEqual(playerOf(fight).action, "chant");
    fight.step([IDLE]);
    fight.step([CHANT]);
    assert.equal(playerOf(fight).action, "chant");
  });

  test("a sword hit only hurts: the chant goes on", () => {
    const fight = new Fight({ arena: ARENA, players: [player(at(0, -1))], enemies: [enemy(SWORDSMAN, at(0, 1))] });
    fight.step([CHANT]);
    run(fight, 1.2, () => CHANT);
    assert.ok(fight.world.require(fight.players[0]!, Health).hp < 100, "cut");
    assert.equal(playerOf(fight).action, "chant");
  });

  test("a dodge closes it, and it doesn't reopen on its own", () => {
    const fight = alone();
    run(fight, 0.3);
    fight.step([CHANT]);
    fight.step([input({ chant: true, dodge: true, moveX: 1 })]);
    assert.equal(playerOf(fight).action, "dodge");
    run(fight, 1, () => CHANT);
    assert.equal(playerOf(fight).action, "none");
  });
});

describe("what may be cast", () => {
  test("a skill that's on none of the pages isn't cast outside a chant", () => {
    const fight = alone();
    run(fight, 0.3);
    fight.step([input({ cast: BOLT_FIRE })]);
    run(fight, releaseTime(BOLT_FIRE) + 0.1);
    assert.equal(shots(fight), 0);
    assert.equal(playerOf(fight).action, "none");
  });

  test("chanting, it is: the cast closes the chant", () => {
    const fight = alone();
    run(fight, 0.3);
    fight.step([CHANT]);
    fight.step([input({ chant: true, cast: BOLT_FIRE })]);
    assert.equal(playerOf(fight).action, "cast");
    run(fight, releaseTime(BOLT_FIRE));
    assert.equal(shots(fight), 1);
    assert.equal(playerOf(fight).action, "none");
  });

  test("closed on the step it's cast, the chanted skill still goes off", () => {
    const fight = alone();
    run(fight, 0.3);
    fight.step([CHANT]);
    fight.step([input({ cast: BOLT_FIRE })]);
    assert.equal(playerOf(fight).action, "cast");
  });

  test("a skill on a page is cast at any time, matched by its words, not by being the same object", () => {
    const copy: Skill = JSON.parse(JSON.stringify({
      segments: [{ modifiers: [], elements: ["fire"], form: "bolt" }],
    }));
    const fight = alone([null, BOLT_FIRE, null, null]);
    run(fight, 0.3);
    fight.step([input({ cast: copy })]);
    assert.equal(playerOf(fight).action, "cast");
  });
});

describe("without the skillbook in hand", () => {
  const bookless = (book = blankSkillbook()) => new Fight({
    arena: ARENA, players: [player(at(0, -4), { book, gear: BOOKLESS })],
    enemies: [enemy(STATUE, at(0, 6))],
  });

  test("a skill on a page doesn't quick-cast", () => {
    const fight = bookless([BOLT_FIRE, null, null, null]);
    run(fight, 0.3);
    fight.step([input({ cast: BOLT_FIRE })]);
    run(fight, releaseTime(BOLT_FIRE) + 0.1);
    assert.equal(shots(fight), 0);
  });

  test("nothing is written from the chant", () => {
    const fight = bookless();
    run(fight, 0.3);
    fight.step([CHANT]);
    fight.step([input({ chant: true, write: { page: 0, skill: NOVA_WATER } })]);
    run(fight, SAVE_IN_FIGHT_TIME + 0.1, () => CHANT);
    assert.equal(playerOf(fight).action, "chant");
    assert.deepEqual(playerOf(fight).book, blankSkillbook());
  });
});

describe("the chant's words, in the fight", () => {
  const words = (fight: Fight, i = 0) => fight.world.require([...fight.players, ...fight.enemies][i]!, Skilled);
  const chanting = (...chantWords: Word[]) => input({ chant: true, chantWords });

  test("are what the input last said, and everyone's copy of the fight has them", () => {
    const fight = alone();
    run(fight, 0.3);
    fight.step([CHANT]);
    fight.step([chanting("bolt")]);
    fight.step([CHANT]);
    fight.step([chanting("bolt", "fire")]);
    assert.deepEqual(words(fight).words, ["bolt", "fire"]);
    assert.equal(words(fight).chanting, true);
    assert.deepEqual(fight.save().players[0]!.skilled.words, ["bolt", "fire"]);
  });

  test("are taken once, as the input brings them: the fight's own changes aren't undone by the same input", () => {
    const fight = alone();
    run(fight, 0.3);
    fight.step([CHANT]);
    fight.step([chanting("bolt", "fire")]);
    words(fight).words = [];
    fight.step([chanting("bolt", "fire")]);
    assert.deepEqual(words(fight).words, []);
  });

  test("a dodge closes the chant and keeps them", () => {
    const fight = alone();
    run(fight, 0.3);
    fight.step([CHANT]);
    fight.step([chanting("bolt", "fire")]);
    fight.step([input({ chant: true, dodge: true, moveX: 1 })]);
    assert.equal(words(fight).chanting, false);
    assert.deepEqual(words(fight).words, ["bolt", "fire"]);
  });

  test("a hit that stuns loses them", () => {
    const fight = new Fight({ arena: ARENA, players: [player(at(0, -1))], enemies: [enemy(BITER, at(0, 1.5))] });
    fight.step([CHANT]);
    fight.step([chanting("bolt", "fire")]);
    stepWhile(fight, "chant", CHANT);
    assert.equal(words(fight).chanting, false);
    assert.deepEqual(words(fight).words, []);
  });

  test("released, they're gone", () => {
    const fight = alone();
    run(fight, 0.3);
    fight.step([CHANT]);
    fight.step([chanting("bolt", "fire")]);
    fight.step([input({ chant: true, cast: BOLT_FIRE })]);
    assert.equal(words(fight).chanting, false);
    assert.deepEqual(words(fight).words, []);
  });
});

describe("writing a page in a fight", () => {
  const write = (page: number, written: Skill) => input({ chant: true, write: { page, skill: written } });

  test("it takes SAVE_IN_FIGHT_TIME standing still; then the page has the skill and the chant goes on", () => {
    const fight = alone();
    run(fight, 0.3);
    fight.step([CHANT]);
    fight.step([write(1, NOVA_WATER)]);
    assert.equal(playerOf(fight).action, "write");
    const before = flatPos(fight);
    const events: FightEvent[] = [];
    const steps = Math.round(SAVE_IN_FIGHT_TIME / FIXED_DT);
    for (let i = 1; i < steps - 1; i++) {
      fight.step([input({ chant: true, moveX: 1 })]);
      events.push(...fight.events);
    }
    assert.deepEqual(playerOf(fight).book, blankSkillbook(), "not yet");
    fight.step([CHANT]);
    events.push(...fight.events);
    assert.deepEqual(playerOf(fight).book, [null, NOVA_WATER, null, null]);
    assert.equal(playerOf(fight).action, "chant");
    assert.deepEqual(events.filter((e) => e.type === "pageWritten"), [
      { type: "pageWritten", player: fight.players[0], page: 1 },
    ]);
    const after = flatPos(fight);
    assert.ok(Math.hypot(after.x - before.x, after.z - before.z) < 0.01, "stood still");
  });

  test("once written, the page casts without a chant", () => {
    const fight = alone();
    run(fight, 0.3);
    fight.step([CHANT]);
    fight.step([write(0, NOVA_WATER)]);
    run(fight, SAVE_IN_FIGHT_TIME, () => CHANT);
    fight.step([IDLE]);
    fight.step([input({ cast: NOVA_WATER })]);
    assert.equal(playerOf(fight).action, "cast");
  });

  test("not without the chant open", () => {
    const fight = alone();
    run(fight, 0.3);
    fight.step([input({ write: { page: 0, skill: NOVA_WATER } })]);
    run(fight, SAVE_IN_FIGHT_TIME + 0.1);
    assert.deepEqual(playerOf(fight).book, blankSkillbook());
  });

  test("closing the chant stops the writing, and nothing is written", () => {
    const fight = alone();
    run(fight, 0.3);
    fight.step([CHANT]);
    fight.step([write(0, NOVA_WATER)]);
    run(fight, 0.5, () => CHANT);
    fight.step([IDLE]);
    assert.equal(playerOf(fight).action, "none");
    run(fight, SAVE_IN_FIGHT_TIME);
    assert.deepEqual(playerOf(fight).book, blankSkillbook());
  });

  test("a hit that stuns cancels it", () => {
    const fight = new Fight({ arena: ARENA, players: [player(at(0, -1))], enemies: [enemy(BITER, at(0, 1.5))] });
    fight.step([CHANT]);
    fight.step([write(2, NOVA_WATER)]);
    assert.equal(playerOf(fight).action, "write");
    run(fight, SAVE_IN_FIGHT_TIME + 0.2, () => CHANT);
    assert.ok(fight.world.require(fight.players[0]!, Health).hp < 100, "bitten");
    assert.deepEqual(playerOf(fight).book, blankSkillbook());
  });

  test("saved mid-write and loaded into another fight, it finishes the same", () => {
    const a = alone();
    run(a, 0.3);
    a.step([CHANT]);
    a.step([write(3, NOVA_WATER)]);
    run(a, 0.5, () => CHANT);
    const b = alone();
    b.load(JSON.parse(JSON.stringify(a.save())));
    assert.equal(b.hash(), a.hash());
    run(a, SAVE_IN_FIGHT_TIME, () => CHANT);
    run(b, SAVE_IN_FIGHT_TIME, () => CHANT);
    assert.equal(dumpState(b).replace(/"e":\d+/g, ""), dumpState(a).replace(/"e":\d+/g, ""));
    assert.deepEqual(playerOf(b).book[3], NOVA_WATER);
  });
});
