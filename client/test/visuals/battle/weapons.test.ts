import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  ATTACK_KINDS, GUARD_SIDES, ITEMS, mirrorSide, SCREEN_DIR, SWING_DIRS, WEAPONS, type SwingData, type Vec3,
  type WeaponId,
} from "@infinite-tower/shared";
import {
  cutOf, MOTIONS, strokeOf, swingCut, swingFrame, WEAPON_LOOKS, type TrailPose,
} from "../../../src/visuals/battle/weapons.js";
import { swingAt, swingSteps, waySwingAt } from "../../fixtures/swings.js";

const { trail: trailPose, windup, stroke: strokeBlade, held } = MOTIONS.sword;
const near = (a: Vec3, b: Vec3, msg: string) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-9, msg);

/** Where on screen (seen from behind: x right, y up) the trail's growing tip is. */
const onScreen = (pose: TrailPose) => {
  const along = pose.from * (1 - 2 * pose.reach);
  return { x: along * Math.cos(pose.rollRad), y: along * Math.sin(pose.rollRad) };
};

describe("a cut's way across the screen", () => {
  test("a light from a side goes across from it; from the top, down; a heavy cleaves down and across", () => {
    assert.deepEqual(cutOf("light", "left"), { x: 1, y: 0 });
    assert.deepEqual(cutOf("light", "right"), { x: -1, y: 0 });
    assert.deepEqual(cutOf("light", "top"), { x: 0, y: -1 });
    for (const side of ["left", "right"] as const) {
      const cut = cutOf("heavy", side);
      assert.ok(cut.y < 0 && Math.sign(cut.x) === Math.sign(cutOf("light", side).x), side);
    }
  });

  test("seen from in front, left and right swap", () => {
    for (const attack of ATTACK_KINDS) {
      for (const side of GUARD_SIDES) assert.deepEqual(cutOf(attack, side, true), cutOf(attack, mirrorSide(side)));
    }
  });
});

describe("a swing's cut, either style", () => {
  test("For Honor's from its attack and side; the hybrid's along its way, mirrored seen from in front", () => {
    assert.deepEqual(swingCut(swingAt("heavy", "right", 0)), cutOf("heavy", "right"));
    assert.deepEqual(swingCut(swingAt("light", "left", 0), true), cutOf("light", "left", true));
    for (const way of SWING_DIRS) {
      assert.deepEqual(swingCut(waySwingAt(way, 0)), SCREEN_DIR[way], way);
      const seen = swingCut(waySwingAt(way, 0), true);
      assert.ok(Math.abs(seen.x + SCREEN_DIR[way].x) < 1e-9 && seen.y === SCREEN_DIR[way].y, `${way} mirrored`);
    }
  });

  test("a stab leaves no trail", () => {
    const { liveAt } = waySwingAt("stab", 0);
    assert.equal(trailPose(waySwingAt("stab", liveAt)), null);
    assert.notEqual(trailPose(waySwingAt("lr", liveAt)), null);
  });
});

describe("a swing's stroke and frames", () => {
  test("drawn back, then driven faster and faster to the hit, live, then following through", () => {
    const steps = swingSteps("light", "left"), { driveAt, liveAt, liveUntil, endAt } = steps[0]!;
    const strokes = steps.map(strokeOf);
    assert.equal(strokes[0]!.set, 0);
    assert.equal(strokes[driveAt]!.set, 1);
    assert.ok(Math.abs(strokes[liveAt]!.turn - 1 / 3) < 1e-9 && Math.abs(strokes[liveUntil]!.turn - 2 / 3) < 1e-9);
    assert.equal(strokeOf({ ...steps[0]!, step: endAt }).turn, 1);
    const turned = strokes.map((s) => s.turn);
    assert.deepEqual(turned, [...turned].sort((a, b) => a - b), "never back");
  });

  test("wound up while drawn back and slow to start, striking around the hit, then following through", () => {
    const steps = swingSteps("light", "left"), frames = steps.map(swingFrame);
    const { driveAt, liveAt, liveUntil } = steps[0]!;
    assert.deepEqual(frames, [...frames].sort(), "in order");
    assert.equal(frames[(driveAt + liveAt) >> 1], 0, "halfway through the drive it has barely moved");
    assert.equal(frames[liveAt], 1);
    assert.equal(frames.at(-1), 2);
    assert.ok(frames.indexOf(2) >= liveUntil);
  });
});

describe("the sword trail", () => {
  test("goes across the screen the way the cut goes, as its wielder sees it", () => {
    for (const attack of ATTACK_KINDS) {
      for (const side of GUARD_SIDES) {
        const poses = swingSteps(attack, side).map(trailPose).filter((pose) => pose !== null);
        assert.ok(poses.length > 0, `${attack} ${side} shows a trail`);
        const from = onScreen(poses[0]!), to = onScreen(poses.at(-1)!);
        const move = { x: to.x - from.x, y: to.y - from.y }, len = Math.hypot(move.x, move.y);
        const want = cutOf(attack, side);
        assert.ok(len > 1.5, `${attack} ${side} goes from one end of its line to the other`);
        assert.ok((move.x * want.x + move.y * want.y) / len > 0.99, `${attack} ${side} goes ${JSON.stringify(move)}`);
      }
    }
  });

  test("a slower swing (a heavier blade) draws its trail as much slower", () => {
    const slowed = (swing: SwingData): SwingData => ({
      ...swing, step: swing.step * 2, driveAt: swing.driveAt * 2, liveAt: swing.liveAt * 2,
      liveUntil: swing.liveUntil * 2, endAt: swing.endAt * 2,
    });
    const steps = swingSteps("light", "left");
    assert.deepEqual(steps.map((swing) => trailPose(slowed(swing))), steps.map(trailPose));
  });

  test("a swing draws the same trail, around its own aim, whatever that aim is", () => {
    const trail = (yaw: number) => swingSteps("light", "left", yaw).map(trailPose);
    const [first, ...rest] = [0, 0.8, -1.5].map(trail);
    rest.forEach((poses, i) => assert.deepEqual(poses, first, `aim ${i + 2} is like the first`));
  });
});

describe("a held blade", () => {
  test("winds up from the guard to where its cut starts, then sweeps through straight ahead to the other end", () => {
    const cut = cutOf("light", "left");
    const start = windup(cut, 1, held(cut)).blade, mid = strokeBlade(cut, 0.5).blade, end = strokeBlade(cut, 1).blade;
    assert.ok(start.x > 0.5 && end.x < -0.5, "across, the way it goes");
    assert.ok(mid.z > 0.9, "straight ahead halfway");
  });

  test("on guard, it's held out toward where its side's cut starts, up and ahead from the top", () => {
    for (const side of GUARD_SIDES) {
      const cut = cutOf("light", side), guard = held(cut).blade, start = windup(cut, 1, held(cut)).blade;
      assert.ok(guard.x * start.x + guard.y * start.y > 0.5, side);
    }
    assert.ok(held(cutOf("light", "top")).blade.y > 0.7);
  });

  test("the wind-up starts from where the blade is held", () => {
    const from = held(cutOf("light", "right"));
    for (const side of GUARD_SIDES) near(windup(cutOf("heavy", side), 0, from).blade, from.blade, side);
  });
});

describe("weapon looks", () => {
  test("a longer weapon's blade is drawn as much longer, and a heavier one's no thinner", () => {
    const ids = Object.keys(WEAPONS) as WeaponId[];
    for (const a of ids) {
      for (const b of ids) {
        const la = WEAPON_LOOKS[a].blade, lb = WEAPON_LOOKS[b].blade;
        const ratio = WEAPONS[a].length / WEAPONS[b].length;
        assert.ok(Math.abs(la.lengthM / lb.lengthM - ratio) < 1e-9, `${a} vs ${b}: length`);
        if (ITEMS[a].weight > ITEMS[b].weight) assert.ok(la.widthM >= lb.widthM, `${a} vs ${b}: width`);
      }
    }
  });
});
