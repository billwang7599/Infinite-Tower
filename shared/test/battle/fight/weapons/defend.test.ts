import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  COUNTER_PARRY, Health, HYBRID, Player, Stamina, Wielder, type PlayerInputData,
} from "@infinite-tower/shared";
import { Fight, initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import { ARENA, FULL_HP, FULL_STAMINA, input, player } from "../fixtures.js";

// Before the describes: they run fights to find when the attacks land.
await initPhysics();

const pvp = () => new Fight({
  arena: ARENA, duel: true, enemies: [],
  players: [player({ x: 0, y: 0.05, z: 0 }), player({ x: 0, y: 0.05, z: 1.6 })],
});
const FACING_1 = { aimX: 0, aimZ: -1, locked: 0 };
type Script = (s: number) => Partial<PlayerInputData>;

function play(fight: Fight, steps: number, a: Script = () => ({}), b: Script = () => ({})): FightEvent[] {
  const events: FightEvent[] = [];
  for (let i = 0; i < steps; i++) {
    const s = fight.steps + 1;
    fight.step([input({ locked: 1, ...a(s) }), input({ ...FACING_1, ...b(s) })]);
    events.push(...fight.events);
  }
  return events;
}
const hp = (fight: Fight, i: number) => fight.world.require(fight.players[i]!, Health).hp;
const stamina = (fight: Fight, i: number) => fight.world.require(fight.players[i]!, Stamina).value;
const action = (fight: Fight, i: number) => fight.world.require(fight.players[i]!, Player).action;

function landsAt(at: number, strike: "light" | "heavy" | "stab" = "light", way = "lr" as const): number {
  const fight = pvp();
  const events: FightEvent[] = [];
  while (!events.some((e) => e.type === "hit")) {
    events.length = 0;
    events.push(...play(fight, 1, (s) => ({ way, attack: s === at ? strike : null })));
  }
  return fight.steps;
}
const PRESS = 40;

describe("the held block", () => {
  test("stops a weapon from in front, whatever its way, for stamina and a chip of its damage", () => {
    for (const way of ["lr", "tb", "brtl"] as const) {
      const fight = pvp();
      const events = play(fight, 70, (s) => ({ way, attack: s === PRESS ? "light" : null }), () => ({ block: true }));
      const block = events.find((e) => e.type === "block");
      assert.ok(block && block.type === "block" && !block.broken, way);
      const lost = FULL_HP - hp(fight, 1);
      assert.ok(lost > 0 && lost < FULL_HP * 0.05, `${way}: chipped ${lost}`);
      assert.ok(stamina(fight, 1) < FULL_STAMINA, way);
      assert.equal(action(fight, 1), "block", way);
      assert.ok(!events.some((e) => e.type === "hit"), way);
    }
  });

  test("a light's chip is its share of the damage, and the blade stops", () => {
    const open = pvp();
    play(open, 70, (s) => ({ attack: s === PRESS ? "light" : null }));
    const full = FULL_HP - hp(open, 1);
    const fight = pvp();
    play(fight, PRESS + 30, (s) => ({ attack: s === PRESS ? "light" : null }), () => ({ block: true }));
    assert.ok(Math.abs(FULL_HP - hp(fight, 1) - full * HYBRID.block.chipFraction) < 1e-9);
    assert.equal(fight.world.require(fight.players[0]!, Wielder).swing, null);
  });

  test("a heavy breaks it: the blocker staggers", () => {
    const fight = pvp();
    const events = play(fight, PRESS + 50, (s) => ({ attack: s === PRESS ? "heavy" : null }), () => ({ block: true }));
    assert.ok(events.some((e) => e.type === "block" && e.broken));
    assert.equal(action(fight, 1), "stagger");
  });

  test("running out of stamina breaks it", () => {
    const fight = new Fight({
      arena: ARENA, duel: true, enemies: [],
      players: [
        player({ x: 0, y: 0.05, z: 0 }), player({ x: 0, y: 0.05, z: 1.6 }, { vitals: { hp: 100, stamina: 1 } }),
      ],
    });
    const events = play(fight, PRESS + 30, (s) => ({ attack: s === PRESS ? "light" : null }), () => ({ block: true }));
    assert.ok(events.some((e) => e.type === "block" && e.broken));
    assert.equal(action(fight, 1), "stagger");
  });

  test("doesn't cover the back", () => {
    const fight = pvp();
    const events = play(fight, 70, (s) => ({ attack: s === PRESS ? "light" : null }),
      () => ({ block: true, aimZ: 1, locked: null }));
    assert.ok(events.some((e) => e.type === "hit"));
  });
});

describe("the tap parry", () => {
  const hitAt = landsAt(PRESS);
  const tapAt = (step: number): Script => (s) => ({ block: s >= step });

  test("a block pressed just before a weapon lands parries it, free, the attacker open for a riposte", () => {
    for (const tap of [hitAt - Math.round(HYBRID.block.tapParryTime * 60) + 1, hitAt]) {
      const fight = pvp();
      const events = play(fight, hitAt - fight.steps, (s) => ({ attack: s === PRESS ? "light" : null }), tapAt(tap));
      const parry = events.find((e) => e.type === "parry");
      assert.ok(parry && parry.by === fight.players[1], `tap at ${tap}`);
      assert.equal(hp(fight, 1), FULL_HP, `tap at ${tap}`);
      assert.equal(stamina(fight, 1), FULL_STAMINA, `tap at ${tap}`);
      assert.equal(action(fight, 0), "stagger");
      assert.ok(Math.abs(fight.world.require(fight.players[0]!, Health).hitstun - HYBRID.block.riposteTime) < 0.02);
    }
  });

  test("a tap let go again before the hit still parries it", () => {
    const fight = pvp();
    const events = play(fight, hitAt, (s) => ({ attack: s === PRESS ? "light" : null }),
      (s) => ({ block: s >= hitAt - 8 && s < hitAt - 4 }));
    assert.ok(events.some((e) => e.type === "parry" && e.by === fight.players[1]));
    assert.equal(hp(fight, 1), FULL_HP);
  });

  test("the riposte: the parrier's light lands before the attacker can act", () => {
    const fight = pvp();
    play(fight, hitAt, (s) => ({ attack: s === PRESS ? "light" : null }), tapAt(hitAt - 2));
    const events = play(fight, 20, () => ({ block: false }), (s) => ({ attack: s === hitAt + 1 ? "light" : null }));
    assert.ok(events.some((e) => e.type === "hit" && e.target === fight.players[0]));
  });

  test("pressed too early, it's only a held block", () => {
    const fight = pvp();
    const tap = hitAt - Math.round(HYBRID.block.tapParryTime * 60) - 3;
    const events = play(fight, hitAt + 5, (s) => ({ attack: s === PRESS ? "light" : null }), tapAt(tap));
    assert.ok(!events.some((e) => e.type === "parry"));
    assert.ok(events.some((e) => e.type === "block"));
  });

  test("pressed again too soon after the last press, it's only held: tapping can't stand in for holding", () => {
    const fight = pvp();
    const retap = Math.round(HYBRID.block.retapTime * 60);
    const events = play(fight, hitAt + 5, (s) => ({ attack: s === PRESS ? "light" : null }),
      (s) => ({ block: s === hitAt - retap + 2 || s >= hitAt - 2 }));
    assert.ok(!events.some((e) => e.type === "parry"));
  });
});

describe("the counter-parry", () => {
  const hitAt = landsAt(PRESS, "light", "lr");
  const answer = (way: Partial<PlayerInputData>["way"] | "stab", step: number): Script => (s) =>
    way === "stab" ? { attack: s === step ? "stab" : null } : { way, attack: s === step ? "light" : null };

  test("the swing meeting it head-on, just gone live, parries it: the attacker staggers and is knocked back", () => {
    const fight = pvp();
    const events = play(fight, hitAt + 1, (s) => ({ way: "lr", attack: s === PRESS ? "light" : null }),
      answer("lr", PRESS - 2));
    const parry = events.find((e) => e.type === "parry");
    assert.ok(parry && parry.by === fight.players[1] && parry.target === fight.players[0]);
    assert.equal(action(fight, 0), "stagger");
    const hitstun = fight.world.require(fight.players[0]!, Health).hitstun;
    assert.ok(Math.abs(hitstun - COUNTER_PARRY.playerStaggerTime) < 0.05, `${hitstun}`);
  });

  test("a 45° neighbour parries it for a share of the stagger; anything else doesn't", () => {
    const fight = pvp();
    play(fight, hitAt + 1, (s) => ({ way: "lr", attack: s === PRESS ? "light" : null }), answer("tlbr", PRESS - 2));
    const hitstun = fight.world.require(fight.players[0]!, Health).hitstun;
    assert.ok(Math.abs(hitstun - COUNTER_PARRY.playerStaggerTime * COUNTER_PARRY.offAngleShare) < 0.05, `${hitstun}`);
    const wrong = pvp();
    const events = play(wrong, hitAt + 1, (s) => ({ way: "lr", attack: s === PRESS ? "light" : null }),
      answer("tb", PRESS - 2));
    assert.ok(!events.some((e) => e.type === "parry"));
  });

  test("a stab is parried only by a stab", () => {
    const stabAt = landsAt(PRESS, "stab");
    const fight = pvp();
    const events = play(fight, stabAt + 1, (s) => ({ attack: s === PRESS ? "stab" : null }), answer("stab", PRESS - 1));
    assert.ok(events.some((e) => e.type === "parry" && e.by === fight.players[1]));
  });
});
