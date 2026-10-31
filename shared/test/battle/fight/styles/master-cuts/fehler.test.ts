import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { cutDamage, MASTER_CUTS, toSteps, WEAPONS } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { STATS } from "../../fixtures.js";
import {
  both, cuts, hp, inStance, landsAfter, maxHp, playTo, pressAt, pvp, SETTLED, stamina, stanceFrom, swingOf,
} from "./duel.js";

await initPhysics();

const AT = SETTLED;
const LIVE = landsAfter("strike", "vom-tag");
const CUTOFF = toSteps(MASTER_CUTS.fehler.cutoffTime);

function fehler(at: number, to: "ochs" | "pflug" = "ochs", move: "light" | "heavy" = "light") {
  const fight = pvp();
  const a = both(pressAt(AT, { attack: move }), stanceFrom(at, to));
  playTo(fight, at - 1, a);
  const before = { swing: { ...swingOf(fight, 0)! }, stamina: stamina(fight, 0) };
  playTo(fight, at, a);
  return { fight, a, before };
}

describe("Master Cuts' Fehler", () => {
  test("a guard change in a wind-up turns the attack into the new guard's, for its stamina", () => {
    const { fight, before } = fehler(AT + 5);
    const swing = swingOf(fight, 0)!;
    assert.equal(swing.stance, "ochs");
    assert.equal(swing.attack, "light");
    assert.equal(swing.damage, cutDamage(WEAPONS.sword, "strike", "ochs", STATS));
    assert.equal(swing.liveAt, before.swing.liveAt, "its wind-up runs on");
    assert.equal(cuts(fight, 0).to, "ochs");
    assert.equal(cuts(fight, 0).moveSteps, 0, "the guard is there at once");
    assert.equal(stamina(fight, 0), before.stamina - MASTER_CUTS.fehler.cost);
  });

  test("a master cut turns into the new guard's master cut", () => {
    const { fight } = fehler(AT + 3, "pflug", "heavy");
    assert.equal(swingOf(fight, 0)?.stance, "pflug");
    assert.equal(swingOf(fight, 0)?.attack, "heavy");
  });

  test("its wind-up is left at least its least", () => {
    const at = AT + LIVE - CUTOFF - 1;
    const { fight } = fehler(at);
    const swing = swingOf(fight, 0)!;
    assert.ok(swing.stance === "ochs");
    assert.ok(swing.liveAt - swing.step >= toSteps(MASTER_CUTS.fehler.minWindupTime) - 1);
  });

  test("with too little wind-up left it waits for the blade", () => {
    const { fight } = fehler(AT + LIVE - CUTOFF + 1);
    assert.equal(swingOf(fight, 0)!.stance, "vom-tag");
  });

  test("once per attack", () => {
    const fight = pvp();
    const a = both(pressAt(AT, { attack: "light" }), stanceFrom(AT + 3, "ochs"), stanceFrom(AT + 6, "alber"));
    playTo(fight, AT + 7, a);
    assert.equal(swingOf(fight, 0)!.stance, "ochs");
  });

  test("the turned attack lands as the new guard's: a reader in the old breaker binds", () => {
    const fight = pvp();
    const a = both(pressAt(AT, { attack: "light" }), stanceFrom(AT + 3, "ochs"));
    const b = both(inStance("pflug"), pressAt(AT + LIVE - 5, { attack: "heavy" }));
    const events = playTo(fight, AT + LIVE + 2, a, b);
    const ev = events.find((e) => e.type === "cut");
    assert.ok(ev?.type === "cut" && ev.what === "bind");
    assert.equal(hp(fight, 1), maxHp(fight, 1));
  });
});
