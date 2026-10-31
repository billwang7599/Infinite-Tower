import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { Body, Health, HYBRID, Player, Stamina, type PlayerInputData } from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ARENA, FULL_HP, FULL_STAMINA, input, player } from "../../fixtures.js";

before(() => initPhysics());

const pvp = (gap = 1.2) => new Fight({
  arena: ARENA, duel: true, enemies: [], style: "hybrid",
  players: [player({ x: 0, y: 0.05, z: 0 }), player({ x: 0, y: 0.05, z: gap })],
});
type Script = (s: number) => Partial<PlayerInputData>;

function play(fight: Fight, steps: number, a: Script = () => ({}), b: Script = () => ({})): FightEvent[] {
  const events: FightEvent[] = [];
  for (let i = 0; i < steps; i++) {
    const s = fight.steps + 1;
    fight.step([input({ locked: 1, ...a(s) }), input({ aimX: 0, aimZ: -1, locked: 0, ...b(s) })]);
    events.push(...fight.events);
  }
  return events;
}
const KICK_AT = 30;
const kicking: Script = (s) => ({ kick: s === KICK_AT });
const kicks = (events: FightEvent[]) => events.filter((e) => e.type === "kick");
const STEPS = KICK_AT + Math.round(HYBRID.kick.contactTime * 60) + 2;

describe("the hybrid's kick", () => {
  test("costs stamina, deals no damage, and shoves someone standing there", () => {
    const fight = pvp(), them = fight.players[1]!;
    const events = play(fight, STEPS, kicking);
    assert.deepEqual(kicks(events).map((e) => e.type === "kick" && e.result), ["shoved"]);
    assert.equal(fight.world.require(fight.players[0]!, Stamina).value, FULL_STAMINA - HYBRID.kick.cost);
    assert.equal(fight.world.require(them, Health).hp, FULL_HP);
    assert.ok(fight.world.require(them, Body).vel.z > 1, "pushed away");
  });

  test("staggers someone holding a block", () => {
    const fight = pvp();
    const events = play(fight, STEPS, kicking, () => ({ block: true }));
    assert.deepEqual(kicks(events).map((e) => e.type === "kick" && e.result), ["staggered"]);
    assert.equal(fight.world.require(fight.players[1]!, Player).action, "stagger");
    const hitstun = fight.world.require(fight.players[1]!, Health).hitstun;
    assert.ok(hitstun > HYBRID.kick.staggerTime - 0.1, `${hitstun}`);
  });

  test("does nothing to someone mid-swing", () => {
    const fight = pvp();
    const events = play(fight, STEPS, kicking, (s) => ({ attack: s === KICK_AT ? "heavy" : null }));
    assert.deepEqual(kicks(events).map((e) => e.type === "kick" && e.result), ["nothing"]);
    assert.notEqual(fight.world.require(fight.players[1]!, Player).action, "stagger");
  });

  test("reaches only so far, in front", () => {
    const events = play(pvp(HYBRID.kick.reachM + 1), STEPS, kicking);
    assert.equal(kicks(events).length, 0);
  });

  test("is over after its time: the kicker stands free again", () => {
    const fight = pvp();
    play(fight, KICK_AT + Math.round(HYBRID.kick.time * 60) + 1, kicking);
    assert.equal(fight.world.require(fight.players[0]!, Player).action, "none");
  });
});
