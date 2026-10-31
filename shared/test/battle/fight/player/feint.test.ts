import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  attackCost, attackSteps, FEINT, FIXED_DT, Player, Stamina, WEAPONS, Wielder, type PlayerInputData,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ARENA, enemy, FULL_STAMINA, input, player, STATUE } from "../fixtures.js";

before(() => initPhysics());

const HEAVY = attackSteps(WEAPONS.sword, "heavy", 0);
const LAST_FEINT_STEP = HEAVY.liveAt - Math.round(FEINT.cutoffTime / FIXED_DT) - 1;
const PRESS = 5;

function play(until: number, script: (step: number) => Partial<PlayerInputData>) {
  const fight = new Fight({
    arena: ARENA, players: [player({ x: 0, y: 0.05, z: 0 })],
    enemies: [enemy({ ...STATUE, maxHp: 1000 }, { x: 0, y: 0.05, z: 2 })],
  });
  const events: FightEvent[] = [];
  while (fight.steps < until) {
    fight.step([input(script(fight.steps + 1))]);
    events.push(...fight.events);
  }
  const me = fight.players[0]!;
  return {
    events, player: fight.world.require(me, Player), swing: fight.world.require(me, Wielder).swing,
    stamina: fight.world.require(me, Stamina).value, hits: events.filter((e) => e.type === "hit").length,
  };
}

const feinting = (kind: "light" | "heavy", feintAfter: number) => (step: number) =>
  ({ attack: step === PRESS ? kind : null, guardBreak: step === PRESS + feintAfter });

describe("a feint", () => {
  test("guard break pressed in a heavy's wind-up, up to its cutoff, cancels it: no hit, its cost paid, free again",
    () => {
      for (const after of [1, LAST_FEINT_STEP]) {
        const p = play(PRESS + after, feinting("heavy", after));
        assert.ok(p.events.some((e) => e.type === "feint"), `${after} steps in`);
        assert.equal(p.swing, null);
        assert.equal(p.player.action, "none");
        assert.equal(p.stamina, FULL_STAMINA - attackCost(WEAPONS.sword, "heavy") - FEINT.cost);
        assert.equal(play(PRESS + HEAVY.endAt, feinting("heavy", after)).hits, 0, `${after} steps in`);
      }
    });

  test("past the cutoff, it doesn't: the heavy lands", () => {
    const p = play(PRESS + HEAVY.endAt, feinting("heavy", LAST_FEINT_STEP + 1));
    assert.ok(!p.events.some((e) => e.type === "feint"));
    assert.equal(p.hits, 1);
  });

  test("a light can't be feinted", () => {
    const p = play(PRESS + HEAVY.endAt, feinting("light", 3));
    assert.ok(!p.events.some((e) => e.type === "feint"));
    assert.equal(p.hits, 1);
  });
});
