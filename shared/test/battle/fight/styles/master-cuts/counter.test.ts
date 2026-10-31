import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  breakerOf, BREAKS, COUNTER_STEPS, cutCost, guardMoveSteps, MASTER_CUTS, toSteps, WEAPONS, type CutMove,
  type Stance,
} from "@infinite-tower/shared";
import { initPhysics, type FightEvent } from "@infinite-tower/shared/fight";
import {
  both, hitstun, hp, inStance, landsAfter, maxHp, me, playTo, pressAt, pvp, SETTLED, stamina, stanceFrom, swingOf,
  type Script,
} from "./duel.js";

await initPhysics();

const AT = SETTLED;
const PRESS: Record<CutMove, "light" | "heavy"> = { strike: "light", cut: "heavy" };

interface Exchange {
  attacker: Stance;
  move?: CutMove;
  defender: Stance;
  /** Steps before the attack lands that the counter is pressed. */
  lead?: number;
  defense?: Script;
}

function exchange({ attacker, move = "strike", defender, lead = 5, defense }: Exchange) {
  const fight = pvp(), lands = AT + landsAfter(move, attacker);
  const a = both(inStance(attacker), pressAt(AT, { attack: PRESS[move] }));
  const b = defense ?? both(inStance(defender), pressAt(lands - lead, { attack: "heavy" }));
  playTo(fight, lands - lead - 1, a, b);
  const before = { a: stamina(fight, 0), b: stamina(fight, 1) };
  const events = playTo(fight, lands, a, b);
  return { fight, events, before, lands, a, b };
}

const cutEvent = (events: FightEvent[]) => events.find((e) => e.type === "cut");

describe("Master Cuts' counter", () => {
  test("from the guard that breaks the attacker's it displaces: the attack ends, its thrower opened", () => {
    for (const attacker of ["vom-tag", "ochs", "pflug", "alber"] as const) {
      const { fight, events, before } = exchange({ attacker, defender: breakerOf(attacker) });
      const ev = cutEvent(events);
      assert.ok(ev && ev.type === "cut" && ev.what === "displace", attacker);
      assert.equal(swingOf(fight, 0), null);
      assert.equal(me(fight, 0).action, "stagger");
      assert.ok(Math.abs(hitstun(fight, 0) - MASTER_CUTS.counter.openTime) < 0.02);
      assert.equal(hp(fight, 1), maxHp(fight, 1), "the defender isn't hurt");
      assert.equal(stamina(fight, 1), before.b, "the counter's stamina is given back");
      assert.equal(swingOf(fight, 1)?.attack, "heavy", "the master cut goes on");
    }
  });

  test("the displacing cut then lands on the opened attacker", () => {
    const { fight, lands, a, b } = exchange({ attacker: "vom-tag", defender: "pflug" });
    playTo(fight, lands + 40, a, b);
    assert.ok(hp(fight, 0) < maxHp(fight, 0));
  });

  test("from any other guard it binds: both attacks end, the attacker recoils longer, each pays", () => {
    const { fight, events, before } = exchange({ attacker: "vom-tag", defender: "ochs" });
    const ev = cutEvent(events);
    assert.ok(ev && ev.type === "cut" && ev.what === "bind");
    assert.equal(swingOf(fight, 0), null);
    assert.equal(swingOf(fight, 1), null);
    assert.equal(me(fight, 0).action, "recoil");
    assert.equal(me(fight, 1).action, "recoil");
    assert.ok(Math.abs(hitstun(fight, 0) - MASTER_CUTS.bind.attackerRecoilTime) < 0.02);
    assert.ok(Math.abs(hitstun(fight, 1) - MASTER_CUTS.bind.counterRecoilTime) < 0.02);
    assert.equal(stamina(fight, 0), before.a - MASTER_CUTS.bind.cost);
    assert.equal(stamina(fight, 1), before.b - MASTER_CUTS.bind.cost);
    assert.equal(hp(fight, 1), maxHp(fight, 1));
  });

  test("its window: pressed up to its time before the attack lands, the landing step counting", () => {
    for (const lead of [0, COUNTER_STEPS]) {
      const { events } = exchange({ attacker: "vom-tag", defender: "ochs", lead });
      assert.ok(cutEvent(events), `lead ${lead}`);
    }
    const { fight, events } = exchange({ attacker: "vom-tag", defender: "ochs", lead: COUNTER_STEPS + 1 });
    assert.equal(cutEvent(events), undefined);
    assert.ok(hp(fight, 1) < maxHp(fight, 1), "too early: it's just a master cut, and the strike lands");
    assert.equal(COUNTER_STEPS, toSteps(MASTER_CUTS.counter.windowTime));
  });

  test("only facing the attack", () => {
    const { fight, events } = exchange({
      attacker: "vom-tag", defender: "pflug",
      defense: (s) => ({ stance: "pflug", aimX: 0, aimZ: 1, ...(s === AT + 20 ? { attack: "heavy" } : {}) }),
    });
    assert.equal(cutEvent(events), undefined);
    assert.ok(hp(fight, 1) < maxHp(fight, 1));
  });

  test("a master cut at the guard it breaks can't be countered: it lands", () => {
    for (const attacker of ["vom-tag", "ochs", "pflug", "alber"] as const) {
      const { fight, events } = exchange({ attacker, move: "cut", defender: BREAKS[attacker] });
      assert.equal(cutEvent(events), undefined, attacker);
      assert.ok(hp(fight, 1) < maxHp(fight, 1), attacker);
    }
  });

  test("a master cut is countered by the rules from any other guard", () => {
    assert.equal(cutEvent(exchange({ attacker: "vom-tag", move: "cut", defender: "pflug" }).events)?.type, "cut");
    const bound = cutEvent(exchange({ attacker: "vom-tag", move: "cut", defender: "ochs" }).events);
    assert.ok(bound?.type === "cut" && bound.what === "bind");
  });

  test("leaving the broken guard before it lands, it meets the new one by the rules", () => {
    const lands = AT + landsAfter("cut", "vom-tag");
    const moved = AT + 1 + guardMoveSteps(WEAPONS.sword.heft, false);
    assert.ok(moved < lands);
    const { events } = exchange({
      attacker: "vom-tag", move: "cut", defender: "alber",
      defense: both(inStance("alber"), stanceFrom(AT + 1, "pflug"), pressAt(moved + 1, { attack: "heavy" })),
    });
    const ev = cutEvent(events);
    assert.ok(ev?.type === "cut" && ev.what === "displace");
  });

  test("a dodge beats it", () => {
    const lands = AT + landsAfter("cut", "vom-tag");
    const { fight } = exchange({
      attacker: "vom-tag", move: "cut", defender: "alber",
      defense: both(inStance("alber"), pressAt(lands - 2, { dodge: true, moveX: 1 })),
    });
    assert.equal(hp(fight, 1), maxHp(fight, 1));
  });

  test("the counter is a master cut, at its own cost", () => {
    assert.equal(cutCost(WEAPONS.sword, "cut"), MASTER_CUTS.cut.cost);
  });
});
