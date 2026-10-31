import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { FIXED_DT, HYBRID, IDLE_INPUT, wayStepsAfter, WEAPONS, Wielder } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { ENEMIES, rollDrops } from "../../../src/core/enemies/index.js";
import { fightWith } from "../../fixtures/fight.js";

before(() => initPhysics());

const GREATSWORD = ENEMIES["kobold-greatsword"].def;
const KOBOLD = ENEMIES["kobold-swordsman"].def;

describe("the Kobold Greatsword", () => {
  test("is the Kobold Swordsman with a greatsword in hand", () => {
    assert.equal(GREATSWORD.wielder?.hands.rightHand, "kobold-greatsword");
    const { id: _id, name: _name, wielder, ...rest } = GREATSWORD;
    const { id: _kid, name: _kname, wielder: koboldWielder, ...kobold } = KOBOLD;
    assert.deepEqual(rest, kobold);
    assert.equal(wielder?.armReachM, koboldWielder?.armReachM);
  });

  test("its heavy blade swings slower: the same wind-ups, stretched by the greatsword's heft", () => {
    const fight = fightWith(GREATSWORD, 1), e = fight.enemies[0]!, def = GREATSWORD.attacks.weapon!;
    const { strength } = GREATSWORD.stats;
    let seen = 0;
    for (let i = 0; i < 30 / FIXED_DT && fight.outcome.state === "fighting"; i++) {
      fight.step([IDLE_INPUT]);
      const swing = fight.world.require(e, Wielder).swing;
      if (swing?.step !== 1) continue;
      const heavy = swing.attack === "heavy", extra = heavy ? HYBRID.heavy.extraTime : 0;
      const windups = [def.windup + extra, def.chainWindup + extra];
      const steps = (t: number) => wayStepsAfter(WEAPONS["kobold-greatsword"], t, heavy, strength).liveAt;
      const at = windups.findIndex((t) => steps(t) === swing.liveAt);
      assert.ok(at >= 0, `live at ${swing.liveAt}`);
      assert.ok(swing.liveAt > wayStepsAfter(WEAPONS["kobold-blade"], windups[at]!, heavy, strength).liveAt);
      seen++;
    }
    assert.ok(seen > 2);
  });

  test("its own blade never drops: only its essence", () => {
    assert.deepEqual(rollDrops("kobold-greatsword", () => 0), { "kobold-greatsword-essence": 1 });
  });
});
