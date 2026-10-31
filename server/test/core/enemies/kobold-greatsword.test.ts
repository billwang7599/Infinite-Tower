import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { attackSteps, FIXED_DT, IDLE_INPUT, WEAPONS, Wielder } from "@infinite-tower/shared";
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

  test("its heavy blade attacks slower: the same tell, then the greatsword's fixed timings", () => {
    const fight = fightWith(GREATSWORD, 1), e = fight.enemies[0]!;
    const seen: { liveAt: number; want: number; sword: number }[] = [];
    for (let i = 0; i < 30 / FIXED_DT && fight.outcome.state === "fighting"; i++) {
      fight.step([IDLE_INPUT]);
      const swing = fight.world.require(e, Wielder).swing;
      if (swing?.step === 1) {
        seen.push({
          liveAt: swing.liveAt, want: attackSteps(WEAPONS["kobold-greatsword"], swing.attack, swing.chain).liveAt,
          sword: attackSteps(WEAPONS["kobold-blade"], swing.attack, swing.chain).liveAt,
        });
      }
    }
    assert.ok(seen.length > 2);
    for (const s of seen) {
      assert.equal(s.liveAt, s.want);
      assert.ok(s.liveAt > s.sword);
    }
  });

  test("its own blade never drops: only its essence", () => {
    assert.deepEqual(rollDrops("kobold-greatsword", () => 0), { "kobold-greatsword-essence": 1 });
  });
});
