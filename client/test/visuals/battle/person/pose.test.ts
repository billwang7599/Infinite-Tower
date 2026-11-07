import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_LOOK, FIXED_DT, PLAYER, type SwingData } from "@infinite-tower/shared";
import { personBuild } from "../../../../src/visuals/battle/person/model.js";
import {
  KEY_EASE_TIME, keyed, personPose, WALK_KEYS, type PersonPose,
} from "../../../../src/visuals/battle/person/pose.js";
import { MOTIONS } from "../../../../src/visuals/battle/weapons.js";
import { playerDoing } from "../../../fixtures/players.js";
import { swingSteps } from "../../../fixtures/swings.js";

const BUILD = personBuild(DEFAULT_LOOK);
const ATTACKING = playerDoing("attack", 0);
const EASE_STEPS = Math.ceil(KEY_EASE_TIME / FIXED_DT);

type Extra = Parameters<typeof personPose>[3];
const pose = (
  player = playerDoing("none", 0), swing: SwingData | null = null, extra: Partial<Extra> = {},
): PersonPose => personPose(player, { swing }, MOTIONS.sword, {
  build: BUILD, side: 1, alive: true, dodge: { x: 0, z: 1 }, stagger: { left: 0, of: 0 }, deadTime: 0,
  walk: { phase: 0, amp: 0 }, ...extra,
});
const close = (a: number, b: number, what: string) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} vs ${b}`);

describe("keyed poses", () => {
  test("ease into each key over a short time, then hold it until the next", () => {
    const at = [0, 1], values = [0, 10, 4];
    assert.equal(keyed(0, at, values), 0);
    const easing = keyed(KEY_EASE_TIME / 2, at, values);
    assert.ok(easing > 0 && easing < 10);
    assert.equal(keyed(KEY_EASE_TIME, at, values), 10);
    assert.equal(keyed(0.9, at, values), 10);
    assert.equal(keyed(1 + KEY_EASE_TIME, at, values), 4);
    assert.equal(keyed(-1, at, values), 0);
  });

  test("a key closer than the ease is reached before the next starts, so nothing jumps", () => {
    const at = [0, KEY_EASE_TIME / 3], values = [0, 10, 4];
    close(keyed(KEY_EASE_TIME / 3 - 1e-12, at, values), 10, "reached");
  });
});

describe("the 3D player's swing, pose to pose", () => {
  for (const attack of ["light", "heavy"] as const) {
    test(`a ${attack} holds its wind-up, holds the strike's end and holds the follow-through`, () => {
      const steps = swingSteps(attack, "lr"), { driveAt, liveAt, liveUntil, endAt } = steps[0]!;
      const at = (step: number) => pose(ATTACKING, steps[step]!);
      assert.ok(driveAt > EASE_STEPS, "the wind-up is longer than the ease");
      assert.deepEqual(at(EASE_STEPS).blade, at(driveAt - 1).blade, "the wind-up held");
      assert.ok(at(driveAt - 1).blade.z < 0, "drawn back behind");
      assert.ok(at(1).lean < 0 && at(1).lean > at(EASE_STEPS).lean, "eased into");
      assert.ok(at(liveUntil - 1).blade.z > at(liveAt).blade.z - 1e-9, "sweeping round in front");
      const follow = Math.min(endAt - 1, liveUntil + EASE_STEPS);
      assert.deepEqual(at(follow).blade, at(endAt - 1).blade, "the follow-through held");
      assert.ok(at(endAt - 1).blade.x > 0.5, "through to the right, where a left-to-right cut ends");
      assert.equal(at(liveAt).bladeExact, true);
    });
  }

  test("a heavy draws back further than a light, and the body coils with the blade", () => {
    const light = swingSteps("light", "lr")[EASE_STEPS]!, heavy = swingSteps("heavy", "lr")[EASE_STEPS]!;
    assert.ok(pose(ATTACKING, heavy).lean < pose(ATTACKING, light).lean);
    const coiled = pose(ATTACKING, light);
    assert.ok(coiled.blade.x < 0 && coiled.twist < 0, "turned toward the blade, on the left");
  });
});

describe("the 3D player's other actions", () => {
  test("a dodge crouches and leans the way it goes, then recovers, held between", () => {
    const at = (t: number, dodge = { x: 0, z: 1 }) => pose(playerDoing("dodge", t), null, { dodge });
    const launched = at(KEY_EASE_TIME);
    assert.ok(launched.crouch > 0.3 && launched.lean > 0.2);
    assert.deepEqual(at(KEY_EASE_TIME * 1.5), launched, "held");
    assert.ok(at(PLAYER.dodge.duration * 0.95).crouch < launched.crouch, "recovering");
    assert.ok(at(KEY_EASE_TIME, { x: 1, z: 0 }).roll < 0, "to the right, leaning right");
  });

  test("staggered, knocked back, then stumbling", () => {
    const at = (left: number) => pose(playerDoing("stagger", 0.1), null, { stagger: { left, of: 0.8 } });
    const back = at(0.8 - KEY_EASE_TIME), stumble = at(0.4 - KEY_EASE_TIME);
    assert.ok(back.lean < 0 && back.lean < stumble.lean);
  });

  test("defeated, to the knees, then over on its side", () => {
    const at = (deadTime: number) => pose(playerDoing("none", 0), null, { alive: false, deadTime });
    assert.ok(at(KEY_EASE_TIME).crouch > 0.5);
    close(at(2).roll, Math.PI / 2, "fallen");
  });

  test("chanting holds the free hand out in front; aimed, the guard is held on that side", () => {
    assert.ok(pose(playerDoing("chant", 1)).offHand.z > pose(playerDoing("none", 1)).offHand.z + 0.1);
    assert.ok(pose(playerDoing("none", 1, "lr")).blade.x < 0, "a swing from the left, held on the left");
    assert.ok(pose(playerDoing("none", 1, "rl")).blade.x > 0);
  });

  test("walking, the legs hold each key of the stride and ease between", () => {
    const step = (2 * Math.PI) / WALK_KEYS;
    const legs = (phase: number) => pose(undefined, null, { walk: { phase, amp: 0.5 } }).legSwing;
    assert.equal(legs(step * 1.6), legs(step * 1.9));
    assert.notEqual(legs(step * 1.01), legs(step * 1.9));
    assert.equal(pose().legSwing, 0);
  });
});
