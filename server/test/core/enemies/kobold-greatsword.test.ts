import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { Enemy, FIXED_DT, IDLE_INPUT } from "@infinite-tower/shared";
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

  test("its telegraphs are floors: the heavy blade winds up its chained swings slower still", () => {
    const fight = fightWith(GREATSWORD, 1), def = GREATSWORD.attacks.weapon!;
    const windups: number[] = [];
    let last = "";
    for (let i = 0; i < 30 / FIXED_DT && fight.outcome.state === "fighting"; i++) {
      fight.step([IDLE_INPUT]);
      const it = fight.world.require(fight.enemies[0]!, Enemy);
      if (it.state === "weaponWindup" && last !== "weaponWindup") windups.push(it.duration);
      last = it.state;
    }
    assert.ok(windups.length > 2);
    for (const t of windups) assert.ok(t >= def.chainWindup, `${t}`);
    assert.ok(windups.some((t) => t > def.windup), windups.join(", "));
  });

  test("its own blade never drops", () => {
    assert.deepEqual(rollDrops("kobold-greatsword", () => 0), {});
  });
});
