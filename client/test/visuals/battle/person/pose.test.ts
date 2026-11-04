import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_LOOK, FIXED_DT, PLAYER, type SwingData } from "@infinite-tower/shared";
import { personBuild } from "../../../../src/visuals/battle/person/model.js";
import { BREATH, WALK } from "../../../../src/visuals/battle/person/motion.js";
import {
  CLIPS, KEY_EASE_TIME, keyed, legDrop, personPose, POSED_JOINTS, type PersonPose,
} from "../../../../src/visuals/battle/person/pose.js";
import { MOTIONS, WEAPON_LOOKS } from "../../../../src/visuals/battle/weapons.js";
import { playerDoing } from "../../../fixtures/players.js";
import { swingSteps } from "../../../fixtures/swings.js";

const BUILD = personBuild(DEFAULT_LOOK);
const ATTACKING = playerDoing("attack", 0);
const EASE_STEPS = Math.ceil(KEY_EASE_TIME / FIXED_DT);

type Extra = Parameters<typeof personPose>[3];
const pose = (
  player = playerDoing("none", 0), swing: SwingData | null = null, extra: Partial<Extra> = {},
): PersonPose => personPose(player, { swing }, MOTIONS.sword, {
  build: BUILD, side: 1, alive: true, dodge: { x: 0, z: 1 }, stagger: { left: 0, of: 0 }, deadTime: 0, time: 0,
  walk: { phase: 0, amp: 0 }, ...extra,
});
const close = (a: number, b: number, what: string) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} vs ${b}`);
const lean = (p: PersonPose) => p.joints.root.x;
const roll = (p: PersonPose) => p.joints.root.z;
const crouch = (p: PersonPose) => -p.joints["thigh.R"].x;
const twist = (p: PersonPose) => p.joints.hips.y + p.joints.spine.y + p.joints.chest.y;

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
      assert.ok(lean(at(1)) < 0 && lean(at(1)) > lean(at(EASE_STEPS)), "eased into");
      assert.ok(at(liveUntil - 1).blade.z > at(liveAt).blade.z - 1e-9, "sweeping round in front");
      const follow = Math.min(endAt - 1, liveUntil + EASE_STEPS);
      assert.deepEqual(at(follow).blade, at(endAt - 1).blade, "the follow-through held");
      assert.ok(at(endAt - 1).blade.x > 0.5, "through to the right, where a left-to-right cut ends");
      assert.equal(at(liveAt).bladeExact, true);
    });
  }

  test("winding up it sits back on its back leg; striking, the front foot steps in and the body leans through", () => {
    const steps = swingSteps("light", "lr"), { driveAt, liveAt, liveUntil, endAt } = steps[0]!;
    const windup = pose(ATTACKING, steps[driveAt - 1]!), strike = pose(ATTACKING, steps[liveAt + EASE_STEPS]!);
    const follow = pose(ATTACKING, steps[Math.min(endAt - 1, liveUntil + EASE_STEPS)]!);
    assert.ok(lean(windup) < 0 && lean(strike) > 0, "back, then into it");
    assert.ok(strike.joints["thigh.L"].x < windup.joints["thigh.L"].x, "the left foot steps in");
    assert.ok(lean(follow) > 0, "still leaning through after");
    assert.ok(strike.rootY < 0, "the knees bent, the feet still down");
    for (const s of [windup, strike]) {
      const drops = (["R", "L"] as const).map((leg) => legDrop(s.joints[`thigh.${leg}`], s.joints[`shin.${leg}`]));
      assert.ok(Math.abs(drops[0]! - drops[1]!) < 0.012, `both feet near the ground: ${drops}`);
    }
    const lefty = pose(ATTACKING, steps[liveAt + EASE_STEPS]!, { side: -1 });
    close(lefty.joints["thigh.R"].x, strike.joints["thigh.L"].x, "left-handed, the right foot steps in");
  });

  test("a heavy draws back further than a light, and the body coils with the blade", () => {
    const light = swingSteps("light", "lr")[EASE_STEPS]!, heavy = swingSteps("heavy", "lr")[EASE_STEPS]!;
    assert.ok(lean(pose(ATTACKING, heavy)) < lean(pose(ATTACKING, light)));
    const coiled = pose(ATTACKING, light);
    assert.ok(coiled.blade.x < 0 && twist(coiled) < 0, "turned toward the blade, on the left");
    assert.ok(coiled.joints.neck.y > 0, "the head turned back toward the foe");
  });
});

describe("the 3D player's other actions", () => {
  test("a dodge plays its clip: crouched and leaning the way it goes, then recovering, held between", () => {
    const at = (t: number, dodge = { x: 0, z: 1 }) => pose(playerDoing("dodge", t), null, { dodge });
    const launched = at(KEY_EASE_TIME), keys = CLIPS.dodge.joints;
    close(lean(launched), keys.root.x[1], "leaning ahead");
    close(launched.joints["thigh.L"].z, keys["thigh.L"].z[1], "legs apart");
    assert.ok(crouch(launched) > 0.5, "crouched");
    assert.deepEqual(at(KEY_EASE_TIME * 1.5), launched, "held");
    assert.ok(crouch(at(PLAYER.dodge.duration * 0.95)) < crouch(launched), "recovering");
    const right = at(KEY_EASE_TIME, { x: 1, z: 0 });
    close(roll(right), -keys.root.x[1], "to the right, leaning right as far as ahead");
    close(lean(right), 0, "and not ahead");
    assert.ok(right.rootY < 0, "dropped so the feet stay down");
  });

  test("staggered, knocked back, then stumbling", () => {
    const at = (left: number) => pose(playerDoing("stagger", 0.1), null, { stagger: { left, of: 0.8 } });
    const back = at(0.8 - KEY_EASE_TIME), stumble = at(0.4 - KEY_EASE_TIME);
    assert.ok(lean(back) < 0 && lean(back) < lean(stumble));
  });

  test("defeated, to the knees, then over on its side", () => {
    const at = (deadTime: number) => pose(playerDoing("none", 0), null, { alive: false, deadTime });
    assert.ok(crouch(at(KEY_EASE_TIME)) > 0.5);
    close(roll(at(2)), Math.PI / 2, "fallen");
  });

  test("the feet stay flat whatever the legs do", () => {
    const p = pose(playerDoing("dodge", KEY_EASE_TIME));
    for (const s of ["R", "L"] as const) {
      close(p.joints[`foot.${s}`].x + p.joints[`thigh.${s}`].x + p.joints[`shin.${s}`].x, 0, s);
    }
  });

  test("chanting holds the free hand out in front; aimed, the guard is held on that side", () => {
    assert.ok(pose(playerDoing("chant", 1)).offHand.z > pose(playerDoing("none", 1)).offHand.z + 0.1);
    assert.ok(pose(playerDoing("none", 1, "lr")).blade.x < 0, "a swing from the left, held on the left");
    assert.ok(pose(playerDoing("none", 1, "rl")).blade.x > 0);
  });

  test("walking, the legs hold each key of the stride and ease between", () => {
    const step = (2 * Math.PI) / WALK.at.length, held = WALK.easeShare + 0.05;
    const legs = (phase: number) => pose(undefined, null, { walk: { phase, amp: 0.5 } }).joints["thigh.L"].x;
    assert.equal(legs(step * (1 + held)), legs(step * 1.95));
    assert.notEqual(legs(step * 1.01), legs(step * 1.95));
  });

  const stride = (share: number, amp = 1) => pose(undefined, null, { walk: { phase: share * 2 * Math.PI, amp } });
  const held = (key: number) => WALK.at[key]! + 0.9 / WALK.at.length;

  test("a stride: the legs take turns, the body bobs, the hips and shoulders turn against each other", () => {
    const contact = stride(held(0)), passing = stride(held(1)), other = stride(held(2));
    assert.ok(contact.joints["thigh.L"].x < 0 && contact.joints["thigh.R"].x > 0, "left foot ahead, right behind");
    close(other.joints["thigh.R"].x, contact.joints["thigh.L"].x, "half a stride later, the right does the same");
    assert.ok(passing.joints["shin.R"].x > 0.5, "the passing leg's knee lifts");
    assert.ok(passing.rootY > contact.rootY, "up passing, down on contact");
    assert.ok(contact.joints.hips.y * contact.joints.chest.y < 0, "hips and shoulders counter-turn");
    assert.ok(contact.offHand.z < stride(held(2)).offHand.z, "the left arm swings back as the left leg goes ahead");
    assert.ok(contact.joints.root.x > 0, "leaning into it");
  });

  test("a slower walk is a shorter stride", () => {
    assert.ok(Math.abs(stride(held(0), 0.4).joints["thigh.L"].x) < Math.abs(stride(held(0)).joints["thigh.L"].x));
  });

  test("standing, it breathes: the chest rises and falls, the head kept level", () => {
    const at = (time: number) => pose(undefined, null, { time });
    const inhale = at(BREATH.periodTime / 4), exhale = at((3 * BREATH.periodTime) / 4);
    assert.ok(inhale.joints.chest.x < exhale.joints.chest.x, "the chest lifts back breathing in");
    close(inhale.joints.chest.x - exhale.joints.chest.x, -2 * BREATH.chestRad, "by the breath's size");
    assert.ok(inhale.joints.neck.x > exhale.joints.neck.x, "the neck evens it out");
    assert.deepEqual(stride(held(0)).joints.chest.x, stride(held(0)).joints.chest.x);
  });

  test("standing, the feet are apart and the weight on one leg; a left-handed stance is its mirror", () => {
    const right = pose(), left = pose(undefined, null, { side: -1 });
    assert.ok(right.joints["thigh.R"].z > 0 && right.joints["thigh.L"].z < 0, "apart");
    close(left.joints["thigh.L"].x, right.joints["thigh.R"].x, "mirrored");
    close(left.joints["thigh.L"].z, -right.joints["thigh.R"].z, "mirrored out");
  });

  test("every pose keeps its joints within a half turn, and a foot on the ground", () => {
    const poses = [pose(), stride(held(1)), pose(playerDoing("dodge", KEY_EASE_TIME)), pose(playerDoing("block", 1))];
    for (const steps of [swingSteps("light", "lr"), swingSteps("heavy", "rl")]) {
      for (const s of steps) poses.push(pose(ATTACKING, s));
    }
    for (const p of poses) {
      for (const j of POSED_JOINTS) for (const v of Object.values(p.joints[j])) assert.ok(Math.abs(v) < Math.PI / 2, j);
      const drop = (s: "R" | "L") => legDrop(p.joints[`thigh.${s}`], p.joints[`shin.${s}`]);
      const low = Math.min(drop("R"), drop("L"));
      close(p.rootY, -low, "the lower foot down");
    }
  });
});

describe("the 3D player's bow", () => {
  const BOW = WEAPON_LOOKS["training-bow"].bow!;
  const bowPose = (player: ReturnType<typeof playerDoing>, drawn = 0): PersonPose =>
    personPose(player, { swing: null }, MOTIONS.bow, {
      build: BUILD, side: 1, alive: true, dodge: { x: 0, z: 1 }, stagger: { left: 0, of: 0 }, deadTime: 0, time: 0,
      walk: { phase: 0, amp: 0 }, bow: { ...BOW, drawn },
    });

  test("drawing, it's held out ahead at the shoulders, upright, the string hand pulling back with the draw", () => {
    const begun = bowPose(playerDoing("draw", 0.1), 0), half = bowPose(playerDoing("draw", 0.5), 0.5);
    const full = bowPose(playerDoing("draw", 1), 1);
    for (const p of [begun, half, full]) {
      assert.ok(p.hand.z > BUILD.reachM * 0.8, "out ahead");
      assert.ok(Math.abs(p.hand.y - BUILD.shoulderY) < 0.1, "at the shoulders");
      assert.ok(p.blade.y > 0.9, "upright");
      close(p.offHand.x, p.hand.x, "on the string");
    }
    close(begun.offHand.z, begun.hand.z - BOW.braceM, "on the string at rest");
    close(full.offHand.z, full.hand.z - BOW.braceM - BOW.drawM, "pulled back all the way");
    close(half.offHand.z, half.hand.z - BOW.braceM - BOW.drawM / 2, "halfway");
    assert.ok(twist(full) < 0, "turned side-on, the bow arm ahead");
    assert.ok(full.joints["thigh.R"].x < 0 && full.joints["thigh.R"].z > 0 && full.joints["thigh.L"].z < 0,
      "feet planted apart, the bow side's ahead");
  });

  test("loosing, the body rocks back with the string's kick and settles", () => {
    const kick = bowPose(playerDoing("loose", KEY_EASE_TIME)), settled = bowPose(playerDoing("loose", 1));
    assert.ok(lean(kick) < lean(settled) && lean(kick) < lean(bowPose(playerDoing("draw", 1), 1)));
  });

  test("just loosed, the string hand is still back by the face", () => {
    const p = bowPose(playerDoing("loose", 0.05));
    assert.ok(p.offHand.z < p.hand.z - BOW.braceM - BOW.drawM / 2);
  });

  test("carried low at the side at rest, not up like a sword; across the chest to guard", () => {
    const carried = bowPose(playerDoing("none", 1));
    assert.deepEqual(carried.blade, MOTIONS.bow.rest.blade);
    assert.notDeepEqual(MOTIONS.bow.rest.blade, MOTIONS.sword.rest.blade);
    assert.ok(carried.hand.y < BUILD.waistY, "down by the hip");
    assert.ok(carried.hand.x > BUILD.shoulderM, "out at the side");
    assert.ok(bowPose(playerDoing("block", 1)).blade.x < -0.5);
  });
});
