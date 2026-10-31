import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Health, POSTURE, recoveryPerSec } from "@infinite-tower/shared";
import { initPhysics, type Fight } from "@infinite-tower/shared/fight";
import { FULL_HP } from "../../fixtures.js";
import { play, postureOf, pvp, type Script } from "./duel.js";

await initPhysics();

const START = 60;

function recovered(seconds: number, setUp: (fight: Fight) => void = () => {}, b: Script = () => ({})): number {
  const fight = pvp();
  play(fight, 2);
  setUp(fight);
  Object.assign(postureOf(fight, 1), { value: START, calmTime: 0 });
  play(fight, Math.round(seconds * 60), () => ({}), b);
  return START - postureOf(fight, 1).value;
}

const STEP = 1 / 60;
const close = (a: number, b: number, what: string) => assert.ok(Math.abs(a - b) < 1e-6, `${what}: ${a} != ${b}`);

describe("posture's recovery", () => {
  const delay = POSTURE.recovery.delayTime;

  test("none until a while after it last grew, then steadily", () => {
    assert.equal(recovered(delay - STEP), 0);
    const after = recovered(delay + 1);
    close(after, recoveryPerSec(1, false) * (1 + STEP), "a second on");
  });

  test("quicker guarding, slower at low HP", () => {
    const guarded = recovered(delay + 1, () => {}, () => ({ block: true }));
    assert.ok(guarded > recovered(delay + 1));
    close(recoveryPerSec(1, true) / recoveryPerSec(1, false), POSTURE.recovery.guardingFactor, "guarding");
    const low = recovered(delay + 1, (f) => { f.world.require(f.players[1]!, Health).hp = FULL_HP / 10; });
    close(low, recoveryPerSec(0.1, false) * (1 + STEP), "at a tenth of the HP");
    assert.ok(recoveryPerSec(0, false) > 0, "never stops");
  });

  test("a deflect streak ends a while after the last one", () => {
    const fight = pvp();
    Object.assign(postureOf(fight, 0), { streak: 2, streakTime: 0 });
    play(fight, Math.round(POSTURE.deflect.streakTime * 60) - 1);
    assert.equal(postureOf(fight, 0).streak, 2);
    play(fight, 2);
    assert.equal(postureOf(fight, 0).streak, 0);
  });
});
