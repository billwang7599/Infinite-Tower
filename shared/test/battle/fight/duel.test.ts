import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  FIXED_DT, GUARD_SIDES, Health, mirrorSide, Player, PLAYER, releaseTime, SKILL_EFFECTS, type PlayerInputData,
} from "@infinite-tower/shared";
import {
  DUEL_STARTS, Fight, initPhysics, MAX_FIGHT_TIME, playerResult, type FightEvent,
} from "@infinite-tower/shared/fight";
import { ARENA, input, player, segment, skill } from "./fixtures.js";

before(() => initPhysics());

const GAP = 2;
const pvp = (gap = GAP) => new Fight({
  arena: ARENA, duel: true, enemies: [],
  players: [player({ x: 0, y: 0.05, z: 0 }), player({ x: 0, y: 0.05, z: gap })],
});
const FACING_1 = { aimX: 0, aimZ: -1 };

/** Each step, `a` for player 0 (facing +z) and `b` for player 1 (facing -z). */
function play(fight: Fight, steps: number, a: (s: number) => Partial<PlayerInputData> = () => ({}),
  b: (s: number) => Partial<PlayerInputData> = () => ({})): FightEvent[] {
  const events: FightEvent[] = [];
  for (let i = 0; i < steps; i++) {
    const s = fight.steps + 1;
    fight.step([input(a(s)), input({ ...FACING_1, ...b(s) })]);
    events.push(...fight.events);
  }
  return events;
}
const hp = (fight: Fight, i: number) => fight.world.require(fight.players[i]!, Health).hp;

describe("a duel: two players, each the other's foe", () => {
  test("starts with the two facing each other across the arena, and isn't over without enemies", () => {
    const fight = new Fight({
      arena: ARENA, duel: true, enemies: [], players: DUEL_STARTS.map((at) => player(at)),
    });
    assert.ok(DUEL_STARTS[0]!.z < 0 && DUEL_STARTS[1]!.z > 0);
    play(fight, 10);
    assert.equal(fight.outcome.state, "fighting");
  });

  test("a player's attack hurts the other player", () => {
    const fight = pvp();
    play(fight, 60, (s) => (s === 1 ? { attack: "light" } : {}));
    assert.ok(hp(fight, 1) < PLAYER.maxHp);
    assert.equal(hp(fight, 0), PLAYER.maxHp);
  });

  test("a guard on the side across from the attacker's, as each sees it, blocks: the attacker recoils", () => {
    for (const side of GUARD_SIDES) {
      const fight = pvp();
      const events = play(fight, 35, (s) => ({ locked: 1, guard: side, attack: s === 1 ? "light" : null }),
        () => ({ locked: 0, guard: mirrorSide(side) }));
      assert.ok(events.some((e) => e.type === "block" && e.target === fight.players[1]), side);
      assert.equal(hp(fight, 1), PLAYER.maxHp, side);
      assert.equal(fight.world.require(fight.players[0]!, Player).action, "recoil", side);
    }
  });

  test("a guard on the attacker's own side, as the defender sees it, doesn't", () => {
    const fight = pvp();
    play(fight, 60, (s) => ({ locked: 1, guard: "left", attack: s === 1 ? "light" : null }),
      () => ({ locked: 0, guard: "left" }));
    assert.ok(hp(fight, 1) < PLAYER.maxHp);
  });

  test("a Bolt hits the other player", () => {
    const fight = pvp(5);
    const bolt = skill(segment("bolt", ["fire"]));
    const steps = Math.round(releaseTime(bolt) / FIXED_DT) + 60;
    play(fight, steps, (s) => (s === 1 ? { chant: true } : s === 2 ? { cast: bolt } : {}));
    assert.ok(PLAYER.maxHp - hp(fight, 1) >= SKILL_EFFECTS.elements.fire.damage * SKILL_EFFECTS.damage);
    assert.equal(hp(fight, 0), PLAYER.maxHp);
  });

  test("a player's lock is on the other player", () => {
    const fight = pvp();
    assert.deepEqual(fight.targets, fight.players);
  });

  test("over when one is down: the one standing won, the other lost", () => {
    const fight = pvp();
    fight.world.require(fight.players[1]!, Health).hp = 0;
    play(fight, 1);
    assert.equal(fight.outcome.state, "won");
    assert.equal(playerResult(fight.outcome, false, { standing: true, duel: true }), "won");
    assert.equal(playerResult(fight.outcome, false, { standing: false, duel: true }), "lost");
  });

  test("still undecided at the time limit, nobody won", () => {
    const fight = pvp();
    fight.outcome.stateTime = MAX_FIGHT_TIME;
    play(fight, 1);
    assert.equal(fight.outcome.state, "lost");
    assert.equal(playerResult(fight.outcome, false, { standing: true, duel: true }), "lost");
  });

  test("leaving a duel forfeits it, with nothing lost", () => {
    const fight = pvp();
    fight.leave(fight.players[0]!);
    play(fight, 1);
    assert.equal(playerResult(fight.outcome, true, { standing: false, duel: true }), "left");
    assert.equal(playerResult(fight.outcome, false, { standing: true, duel: true }), "won");
  });
});
