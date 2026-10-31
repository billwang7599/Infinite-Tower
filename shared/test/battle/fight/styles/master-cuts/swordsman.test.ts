import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  breakerOf, BREAKS, Cuts, cutSteps, cutWindupTime, ENEMY_GUARD, Health, toSteps, WEAPONS, Wielder, type EnemyDef,
  type MasterCutsSwordsmanDef, type PlayerInputData, type Stance,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ARENA, enemy, input, player, swings, SWORDSMAN } from "../../fixtures.js";

before(() => initPhysics());

const BASE = swings({}).masterCuts;
const kobold = (masterCuts: Partial<MasterCutsSwordsmanDef> = {}, firstDelay = 99): EnemyDef => ({
  ...SWORDSMAN, maxHp: 10_000,
  attacks: { weapon: swings({ firstDelay, cooldown: 99, masterCuts: { ...BASE, ...masterCuts } }) },
});

function play(def: EnemyDef, script: (s: number) => Partial<PlayerInputData> = () => ({})) {
  const fight = new Fight({
    arena: ARENA, style: "master-cuts", players: [player({ x: 0, y: 0.05, z: 0 })],
    enemies: [enemy(def, { x: 0, y: 0.05, z: 2 })],
  });
  const events: FightEvent[] = [];
  const run = (n: number) => {
    for (let i = 0; i < n; i++) {
      fight.step([input({ locked: 0, ...script(fight.steps + 1) })]);
      events.push(...fight.events);
    }
  };
  return { fight, events, run, me: fight.players[0]!, it: fight.enemies[0]! };
}

const guardOf = (fight: Fight, e: number) => fight.world.require(e, Cuts);
const swingOf = (fight: Fight, e: number) => fight.world.require(e, Wielder).swing;
const held = (stance: Stance, attack: { at: number; kind: "light" | "heavy" } | null = null) =>
  (s: number): Partial<PlayerInputData> => ({ stance, attack: attack && s === attack.at ? attack.kind : null });
const heft = WEAPONS.sword.heft;

describe("a swordsman in Master Cuts", () => {
  test("holds a guard, Vom Tag first, and changes it after a while", () => {
    const { fight, it, run } = play(kobold());
    run(10);
    assert.equal(guardOf(fight, it).to, "vom-tag");
    run(toSteps(ENEMY_GUARD.maxHoldTime) + 30);
    assert.notEqual(guardOf(fight, it).to, "vom-tag");
  });

  test("answers your guard after its reaction by moving to the one that breaks it", () => {
    const { fight, it, run } = play(kobold({ answerChance: 1 }), held("ochs"));
    run(toSteps(BASE.reactTime) + 2);
    assert.equal(guardOf(fight, it).want, "vom-tag", "not yet");
    run(40);
    assert.equal(guardOf(fight, it).to, breakerOf("ochs"));
  });

  test("in reach, you standing in the guard its guard breaks, it throws the master cut, wound up to be read", () => {
    const { fight, it, run } = play(kobold({ cutChance: 1 }, 0.5), held(BREAKS["vom-tag"]));
    let swing = null;
    while (!swing && fight.steps < 200) { run(1); swing = swingOf(fight, it); }
    assert.equal(swing?.attack, "heavy");
    assert.equal(swing?.stance, "vom-tag");
    assert.equal(swing?.liveAt, cutSteps(heft, "cut", cutWindupTime("cut", "vom-tag", 0) + BASE.windupExtraTime).liveAt);
  });

  test("otherwise it strikes from its guard", () => {
    const { fight, it, run } = play(kobold({ cutChance: 1 }, 0.5), held("vom-tag"));
    let swing = null;
    while (!swing && fight.steps < 200) { run(1); swing = swingOf(fight, it); }
    assert.equal(swing?.attack, "light");
    assert.equal(swing?.stance, "vom-tag");
    assert.equal(swing?.liveAt,
      cutSteps(heft, "strike", cutWindupTime("strike", "vom-tag", 0) + BASE.windupExtraTime).liveAt);
  });

  test("now and then it turns a strike mid-wind-up (Fehler)", () => {
    const { fight, it, run } = play(kobold({ fehlerChance: 1 }, 0.5), held("vom-tag"));
    const seen = new Set<Stance>();
    while (fight.steps < 200) {
      run(1);
      const swing = swingOf(fight, it);
      if (swing) seen.add(swing.stance!);
      if (seen.size > 1) break;
    }
    assert.ok(seen.size > 1, "its swing changed guard");
  });

  test("displaces your attack from the guard its guard breaks, and binds one from another", () => {
    const displaced = play(kobold({ displaceChance: 1 }), held(BREAKS["vom-tag"], { at: 30, kind: "light" }));
    displaced.run(80);
    const ev = displaced.events.find((e) => e.type === "cut");
    assert.ok(ev?.type === "cut" && ev.what === "displace" && ev.by === displaced.it);
    assert.ok(displaced.fight.world.require(displaced.me, Health).hp < displaced.fight.world.require(displaced.me, Health).max);

    const bound = play(kobold({ bindChance: 1 }), held("pflug", { at: 30, kind: "light" }));
    bound.run(80);
    const bind = bound.events.find((e) => e.type === "cut");
    assert.ok(bind?.type === "cut" && bind.what === "bind" && bind.by === bound.it);
  });

  test("never tries to counter a master cut at the guard it breaks", () => {
    const { fight, events, run, it } = play(kobold({ displaceChance: 1, bindChance: 1 }),
      held(breakerOf("vom-tag"), { at: 30, kind: "heavy" }));
    run(80);
    assert.equal(events.find((e) => e.type === "cut"), undefined);
    assert.ok(fight.world.require(it, Health).hp < fight.world.require(it, Health).max);
  });

  test("wrestles an idle player now and then", () => {
    const { events, run, it } = play(kobold({ wrestleChance: 1 }, 0.5), held("vom-tag"));
    run(120);
    assert.ok(events.some((e) => e.type === "guardBreak" && e.by === it));
  });
});
