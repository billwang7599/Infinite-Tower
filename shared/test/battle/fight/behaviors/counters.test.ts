import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  attackSteps, FEINT, FIXED_DT, GUARD_BREAK, Health, mirrorSide, Player, WEAPONS, Wielder,
  type EnemyDef, type PlayerInputData, type WeaponCounters,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent, type FightSnapshot } from "@infinite-tower/shared/fight";
import { ARENA, busy, dumpState, enemy, GUARDIAN, input, player, swings, SWORDSMAN } from "../fixtures.js";

before(() => initPhysics());

const NONE: WeaponCounters = {
  parryChance: 0, parryLeadTime: 0.2, feintChance: 0, guardBreakChance: 0, techChance: 0, reactTime: 0.25,
};
const guardian = (counters: Partial<WeaponCounters>): EnemyDef => ({
  ...GUARDIAN, maxHp: 1000,
  attacks: { weapon: { ...GUARDIAN.attacks.weapon!, counters: { ...NONE, ...counters } } },
});
const attacker = (counters: Partial<WeaponCounters>, heavyShare = 0): EnemyDef => ({
  ...SWORDSMAN, maxHp: 1000,
  attacks: { weapon: swings({ heavyShare, cooldown: 1, counters: { ...NONE, ...counters } }) },
});

const HEAVY = attackSteps(WEAPONS.sword, "heavy", 0);
const LAST_FEINT_STEP = HEAVY.liveAt - Math.round(FEINT.cutoffTime / FIXED_DT) - 1;
const PRESS = 30;

interface Played { fight: Fight; events: FightEvent[] }

function play(def: EnemyDef, until: number, script: (step: number) => Partial<PlayerInputData>, seed = 1): Played {
  const fight = new Fight({
    arena: ARENA, players: [player({ x: 0, y: 0.05, z: 0 }, { vitals: { hp: 1000, stamina: 100 } })],
    enemies: [{ ...enemy(def, { x: 0, y: 0.05, z: 2 }), seed }],
  });
  const events: FightEvent[] = [];
  while (fight.steps < until) {
    fight.step([input({ locked: 0, guard: "left", ...script(fight.steps + 1) })]);
    events.push(...fight.events);
  }
  return { fight, events };
}

const heavyAt = (at: number) => (step: number) => ({ attack: step === at ? "heavy" as const : null });
const by = (p: Played, type: FightEvent["type"]) => p.events.filter((e) => e.type === type && "by" in e
  && e.by === p.fight.enemies[0]);
const playerHp = (p: Played) => p.fight.world.require(p.fight.players[0]!, Health).hp;
const grabs = (p: Played) => p.events.flatMap((e) => (e.type === "guardBreak" ? [e.result] : []));

describe("the swordsman reads a heavy", () => {
  test("when its roll says so, it parries a heavy aimed at it, and its light lands on the staggered player", () => {
    const p = play(guardian({ parryChance: 1 }), PRESS + HEAVY.liveAt + 60, heavyAt(PRESS));
    assert.equal(by(p, "parry").length, 1);
    assert.ok(playerHp(p) < 1000, "its light landed");
    assert.equal(p.events.filter((e) => e.type === "hit" && e.team === "enemy").length, 0);
  });

  test("when it doesn't, the heavy is only blocked or lands", () => {
    const p = play(guardian({ parryChance: 0 }), PRESS + HEAVY.liveAt + 60, heavyAt(PRESS));
    assert.equal(by(p, "parry").length, 0);
  });

  test("it never parries a light", () => {
    const p = play(guardian({ parryChance: 1 }), PRESS + 60, (s) => ({ attack: s === PRESS ? "light" : null }));
    assert.equal(by(p, "parry").length, 0);
  });

  test("a feint late in the wind-up baits it: its parry is a heavy of its own, which comes anyway", () => {
    const feintAt = PRESS + LAST_FEINT_STEP;
    const p = play(guardian({ parryChance: 1 }), feintAt + 1, (s) => ({
      ...heavyAt(PRESS)(s), guardBreak: s === feintAt,
    }));
    assert.equal(by(p, "parry").length, 0);
    const swing = p.fight.world.require(p.fight.enemies[0]!, Wielder).swing;
    assert.equal(swing?.attack, "heavy");
    assert.equal(swing?.side, mirrorSide("left"));
  });

  test("a feint early in the wind-up doesn't: it never moves", () => {
    const p = play(guardian({ parryChance: 1 }), PRESS + HEAVY.endAt, (s) => ({
      ...heavyAt(PRESS)(s), guardBreak: s === PRESS + 2,
    }));
    assert.equal(p.fight.world.require(p.fight.enemies[0]!, Wielder).swing, null);
    assert.equal(by(p, "parry").length, 0);
  });
});

describe("the swordsman's own feints and guard breaks", () => {
  test("when its roll says so it feints its heavy at the cutoff: the heavy never lands", () => {
    const p = play(attacker({ feintChance: 1 }, 1), 400, () => ({ guard: null, locked: null }));
    assert.ok(by(p, "feint").length >= 2);
    assert.equal(playerHp(p), 1000);
  });

  test("when its roll says so it guard breaks an idle player in reach, and its light lands on them opened", () => {
    const p = play(attacker({ guardBreakChance: 1 }), 200, () => ({}));
    assert.deepEqual(grabs(p).slice(0, 2), ["grabbed", "broken"]);
    assert.ok(playerHp(p) < 1000);
  });

  test("the player can counter its guard break", () => {
    const def = attacker({ guardBreakChance: 1 });
    const grabbedAt = stepOf(def, "grabbed");
    const p = play(def, grabbedAt + 5, (s) => ({ guardBreak: s === grabbedAt + 3 }));
    assert.deepEqual(grabs(p), ["grabbed", "teched"]);
    assert.equal(p.fight.world.require(p.fight.players[0]!, Player).action, "none");
  });

  test("when its roll says so it counters a guard break, its reaction time in", () => {
    const grabAt = 10 + Math.round(GUARD_BREAK.grabTime / FIXED_DT);
    const p = play(guardian({ techChance: 1 }), grabAt + 40, (s) => ({ guardBreak: s === 10 }));
    assert.deepEqual(grabs(p), ["grabbed", "teched"]);
  });

  test("its counters are in the fight's state: a copy loaded mid-fight goes on the same", () => {
    const def = attacker({ parryChance: 0.5, feintChance: 0.5, guardBreakChance: 0.5, techChance: 0.5 }, 0.5);
    const wire = (s: FightSnapshot): FightSnapshot => JSON.parse(JSON.stringify(s));
    const script = (step: number) => ({ ...busy(step), guardBreak: step % 37 < 2 });
    for (const at of [61, 140, 299]) {
      const right = play(def, at, script, 5).fight;
      const copy = play(def, 0, script, 9).fight;
      copy.load(wire(right.save()));
      for (let i = 0; i < 600; i++) {
        const step = right.steps + 1;
        right.step([input(script(step))]);
        copy.step([input(script(step))]);
      }
      assert.equal(dumpState(copy), dumpState(right), `loaded at ${at}`);
    }
  });
});

function stepOf(def: EnemyDef, result: string): number {
  const fight = play(def, 0, () => ({})).fight;
  while (!fight.events.some((e) => e.type === "guardBreak" && e.result === result)) {
    fight.step([input({ locked: 0, guard: "left" })]);
  }
  return fight.steps;
}

