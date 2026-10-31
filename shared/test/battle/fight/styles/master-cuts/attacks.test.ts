import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  cutCost, cutDamage, cutShape, cutSteps, cutWindupTime, MASTER_CUTS, PLAYER, STANCES, WEAPONS, type CutMove,
  type Stance,
} from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { FULL_STAMINA, STATS } from "../../fixtures.js";
import {
  both, hp, holding, inStance, landsAfter, maxHp, playTo, pressAt, pvp, SETTLED, stamina, swingOf,
} from "./duel.js";

await initPhysics();

const AT = SETTLED;
const PRESS: Record<CutMove, "light" | "heavy"> = { strike: "light", cut: "heavy" };

function attackFrom(stance: Stance, move: CutMove) {
  const fight = pvp(), a = both(inStance(stance), pressAt(AT, { attack: PRESS[move] }));
  playTo(fight, AT, a);
  const swing = swingOf(fight, 0)!, before = hp(fight, 1);
  playTo(fight, AT + landsAfter(move, stance) + 1, a);
  return { fight, swing, dealt: before - hp(fight, 1) };
}

describe("Master Cuts' attacks", () => {
  test("left click strikes from your guard, right click throws its master cut, as the table says", () => {
    for (const stance of STANCES) {
      for (const move of ["strike", "cut"] as const) {
        const { fight, swing, dealt } = attackFrom(stance, move);
        assert.equal(swing.stance, stance);
        assert.equal(swing.attack, move === "cut" ? "heavy" : "light");
        assert.deepEqual(
          { liveAt: swing.liveAt, liveUntil: swing.liveUntil, endAt: swing.endAt },
          (({ liveAt, liveUntil, endAt }) => ({ liveAt, liveUntil, endAt }))(
            cutSteps(WEAPONS.sword.heft, move, cutWindupTime(move, stance, 0)),
          ),
          `${stance} ${move}`,
        );
        assert.ok(Math.abs(dealt - cutDamage(WEAPONS.sword, move, stance, STATS)) < 1e-6, `${stance} ${move}`);
        assert.ok(maxHp(fight, 1) > hp(fight, 1));
      }
    }
  });

  test("a strike's damage and reach come from its guard: the thrusts reach further, the Oberhau hits hardest", () => {
    const reach = (stance: Stance, move: CutMove) => cutShape(move, stance, PLAYER.armReachM, WEAPONS.sword).range;
    assert.ok(reach("ochs", "strike") > reach("vom-tag", "strike"));
    assert.equal(reach("ochs", "strike"), reach("pflug", "strike"));
    assert.ok(cutDamage(WEAPONS.sword, "strike", "vom-tag", STATS) > cutDamage(WEAPONS.sword, "strike", "alber", STATS));
    assert.ok(cutShape("strike", "vom-tag", 0.8, WEAPONS.sword).minDot < cutShape("strike", "ochs", 0.8, WEAPONS.sword)
      .minDot, "the Oberhau is wide, the Oberstich narrow");
    assert.ok(reach("vom-tag", "cut") > reach("pflug", "cut"), "the Scheitelhau is long");
  });

  test("each costs its stamina, times the weapon's heft", () => {
    const fight = pvp();
    playTo(fight, AT, pressAt(AT, { attack: "heavy" }));
    assert.equal(stamina(fight, 0), FULL_STAMINA - cutCost(WEAPONS.sword, "cut"));
    assert.equal(cutCost(WEAPONS.greatsword, "strike"), MASTER_CUTS.strike.cost * WEAPONS.greatsword.heft);
  });

  test("a heavier blade's attacks take its heft times as long", () => {
    const fight = pvp(holding("greatsword"));
    playTo(fight, AT, pressAt(AT, { attack: "light" }));
    assert.equal(swingOf(fight, 0)!.liveAt, landsAfter("strike", "vom-tag", 0, WEAPONS.greatsword.heft));
  });

  test("strikes chain in the last one's recovery, three at most, a chained one wound up quicker", () => {
    const fight = pvp();
    let presses = [AT];
    const a = (s: number) => (presses.includes(s) ? { attack: "light" as const } : {});
    playTo(fight, AT, a);
    const first = swingOf(fight, 0)!;
    const second = AT + first.liveUntil;
    presses = [AT, second];
    playTo(fight, second, a);
    assert.equal(swingOf(fight, 0)!.chain, 1);
    assert.equal(swingOf(fight, 0)!.liveAt, landsAfter("strike", "vom-tag", 1));
    assert.ok(landsAfter("strike", "vom-tag", 1) < landsAfter("strike", "vom-tag", 0));
    const third = second + swingOf(fight, 0)!.liveUntil;
    presses = [AT, second, third];
    playTo(fight, third, a);
    assert.equal(swingOf(fight, 0)!.chain, 2);
    const fourth = third + swingOf(fight, 0)!.liveUntil;
    presses = [AT, second, third, fourth];
    const end = third + swingOf(fight, 0)!.endAt;
    playTo(fight, fourth + 1, a);
    assert.equal(swingOf(fight, 0)!.chain, 2, "the fourth waits for the recovery");
    playTo(fight, end + 1, a);
    assert.equal(swingOf(fight, 0)!.chain, 0, "and starts a new chain");
  });

  test("at no stamina a click does nothing, then or later", () => {
    const fight = pvp({ vitals: { hp: 100, stamina: 0 } });
    playTo(fight, 5, pressAt(1, { attack: "heavy" }));
    assert.equal(swingOf(fight, 0), null);
  });
});
