import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  Body, Enemy, Health, OneStrike, PLAYER, thrustReach, toSteps, WEAPONS, Wielder, type EnemyDef,
  type OneStrikeSwordsmanDef, type PlayerInputData,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ARENA, enemy, input, player, swings, SWORDSMAN } from "../../fixtures.js";

before(() => initPhysics());

const BASE = swings({}).oneStrike;
const kobold = (oneStrike: Partial<OneStrikeSwordsmanDef> = {}, over: Partial<EnemyDef> = {}): EnemyDef => ({
  ...SWORDSMAN, maxHp: 10_000, walkSpeed: 2.6,
  sidestep: { chance: 0, reactTime: 0.25, leadTime: 0.1, speed: 8, stepTime: 0.3 },
  attacks: { weapon: swings({ firstDelay: 0.5, oneStrike: { ...BASE, ...oneStrike } }) }, ...over,
});
const MEASURE_GAP = thrustReach(PLAYER.armReachM, WEAPONS.sword) + BASE.measureM;

function play(def: EnemyDef, steps: number, script: (s: number) => Partial<PlayerInputData> = () => ({}), at = 2.4) {
  const fight = new Fight({
    arena: ARENA, style: "one-strike", players: [player({ x: 0, y: 0.05, z: 0 })],
    enemies: [enemy(def, { x: 0, y: 0.05, z: at })],
  });
  const events: FightEvent[] = [];
  const run = (n: number, more = script) => {
    for (let i = 0; i < n; i++) {
      fight.step([input({ locked: 0, ...more(fight.steps + 1) })]);
      events.push(...fight.events);
    }
  };
  run(steps);
  return { fight, events, run, me: fight.players[0]!, it: fight.enemies[0]! };
}

const changeAndThrust = (s: number): Partial<PlayerInputData> =>
  ({ line: s >= 30 ? "high" : null, attack: s === 30 ? "light" : null });
const bladeOf = (fight: Fight, e: number) => fight.world.require(e, OneStrike);
const swingOf = (fight: Fight, e: number) => fight.world.require(e, Wielder).swing;
const gapOf = (fight: Fight) => {
  const a = fight.world.require(fight.players[0]!, Body).pos, b = fight.world.require(fight.enemies[0]!, Body).pos;
  return Math.hypot(a.x - b.x, a.z - b.z) - PLAYER.radius;
};

describe("a swordsman in One Strike", () => {
  test("holds its blade at a line and keeps its own measure: its thrust's reach and a little more", () => {
    const { fight, it } = play(kobold(), 240, () => ({}), 6);
    assert.equal(bladeOf(fight, it).line, "middle");
    assert.ok(Math.abs(gapOf(fight) - MEASURE_GAP) < 0.35, `${gapOf(fight)} vs ${MEASURE_GAP}`);
    assert.equal(swingOf(fight, it), null, "matched, it waits");
  });

  test("matched in reach it may change line and thrust there", () => {
    const def = kobold({ matched: { thrust: 1, beat: 0, wait: 0 }, decideMinTime: 0.5, decideMaxTime: 0.5 });
    const { fight, it, run } = play(def, 0, () => ({}), MEASURE_GAP + PLAYER.radius);
    let line = null;
    while (line === null && fight.steps < 300) {
      run(1);
      line = swingOf(fight, it)?.line ?? null;
    }
    assert.ok(line !== null && line !== "middle", `${line}`);
  });

  test("or beat your blade aside", () => {
    const def = kobold({ matched: { thrust: 0, beat: 1, wait: 0 }, decideMinTime: 0.5, decideMaxTime: 0.5 });
    const { events, me } = play(def, 120, () => ({}), MEASURE_GAP + PLAYER.radius);
    assert.ok(events.some((e) => e.type === "strike" && e.what === "beat" && e.target === me));
  });

  test("facing a mismatched blade in reach, it thrusts at its line", () => {
    const { fight, it, run } = play(kobold(), 0, () => ({ line: "high" }), MEASURE_GAP + PLAYER.radius);
    let line = null;
    while (line === null && fight.steps < 200) {
      run(1);
      line = swingOf(fight, it)?.line ?? null;
    }
    assert.equal(line, "middle");
  });

  test("it follows your change of line after its reaction time", () => {
    const def = kobold({ followChance: 1 }), at = 40, react = toSteps(BASE.reactTime);
    const { fight, it, run } = play(def, at - 1, () => ({}), MEASURE_GAP + PLAYER.radius);
    run(react - 1, () => ({ line: "low" }));
    assert.equal(bladeOf(fight, it).want, "middle");
    run(3, () => ({ line: "low" }));
    assert.equal(bladeOf(fight, it).want, "low");
    run(30, () => ({ line: "low" }));
    assert.equal(swingOf(fight, it), null, "matched again, it waits");
  });

  test("it disarms a thrust at another line when it can move in time", () => {
    const def = kobold({ disarmChance: 1, reactTime: 0.15 });
    const { fight, me, it, events } = play(def, 90, changeAndThrust, MEASURE_GAP + PLAYER.radius - 0.3);
    assert.ok(events.some((e) => e.type === "strike" && e.what === "disarm" && e.target === me));
    assert.equal(fight.world.require(it, Health).hp, 10_000);
  });

  test("or steps back out of its reach", () => {
    const def = kobold({ stepBackChance: 1, reactTime: 0.15 });
    const { fight, it, run } = play(def, 31, changeAndThrust, MEASURE_GAP + PLAYER.radius - 0.3);
    let stepped = false;
    for (let i = 0; i < 30; i++) {
      run(1, () => ({ line: "high" }));
      stepped ||= fight.world.require(it, Enemy).state === "sidestep";
    }
    assert.ok(stepped);
    assert.equal(fight.world.require(it, Health).hp, 10_000);
  });

  test("disarmed, it walks to its blade and picks it up", () => {
    const { fight, it, run } = play(kobold(), 2, () => ({}), 4);
    bladeOf(fight, it).loose = { x: 3, z: 4 };
    let picking = false;
    for (let i = 0; i < 300 && bladeOf(fight, it).loose; i++) {
      run(1);
      picking ||= fight.world.require(it, Enemy).state === "pickup";
    }
    assert.ok(picking);
    assert.equal(bladeOf(fight, it).loose, null);
  });

  test("a longer blade keeps a longer measure", () => {
    const long = kobold({}, { wielder: { hands: { rightHand: "greatsword" }, armReachM: PLAYER.armReachM } });
    const { fight } = play(long, 240, () => ({}), 6);
    const want = thrustReach(PLAYER.armReachM, WEAPONS.greatsword) + BASE.measureM;
    assert.ok(Math.abs(gapOf(fight) - want) < 0.35, `${gapOf(fight)} vs ${want}`);
  });
});
