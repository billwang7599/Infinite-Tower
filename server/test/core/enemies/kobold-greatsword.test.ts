import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  CHAIN, FIXED_DT, IDLE_INPUT, strikeOf, wayStepsAfter, WEAPONS, Wielder, windupTime, type ChainKind,
} from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { ENEMIES } from "../../../src/core/enemies/index.js";
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

  test("its heavy blade swings slower: a player's wind-ups, stretched by the greatsword's heft", () => {
    const fight = fightWith(GREATSWORD, 1), e = fight.enemies[0]!;
    const kinds = Object.keys(CHAIN.startupTime) as ChainKind[];
    let seen = 0;
    for (let i = 0; i < 30 / FIXED_DT && fight.outcome.state === "fighting"; i++) {
      fight.step([IDLE_INPUT]);
      const swing = fight.world.require(e, Wielder).swing;
      if (swing?.step !== 1) continue;
      const strike = strikeOf(swing.attack, swing.way), heavy = strike === "heavy";
      const liveAt = (blade: "kobold-greatsword" | "kobold-blade", kind: ChainKind) =>
        wayStepsAfter(WEAPONS[blade], windupTime(strike, kind), heavy).liveAt;
      const kind = kinds.find((k) => liveAt("kobold-greatsword", k) === swing.liveAt);
      assert.ok(kind, `live at ${swing.liveAt}`);
      assert.ok(swing.liveAt > liveAt("kobold-blade", kind));
      seen++;
    }
    assert.ok(seen > 2);
  });

  test("its own blade never drops: only its essence, besides treasure", () => {
    assert.deepEqual(ENEMIES["kobold-greatsword"].drops.map((d) => d.item), ["kobold-greatsword-essence"]);
  });
});
