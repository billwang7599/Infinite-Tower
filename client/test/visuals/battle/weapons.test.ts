import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  ITEMS, SCREEN_DIR, SWING_DIRS, WEAPONS, type AttackKind, type SwingData, type Vec3, type WeaponId,
} from "@infinite-tower/shared";
import {
  glintOf, MOTIONS, strokeOf, swingFrame, wayCut, WEAPON_LOOKS,
} from "../../../src/visuals/battle/weapons.js";
import { swingSteps, waySwingAt } from "../../fixtures/swings.js";

const { trail, windup, stroke: strokeBlade, held } = MOTIONS.sword;
const near = (a: Vec3, b: Vec3, msg: string) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-9, msg);

const KINDS: readonly AttackKind[] = ["light", "heavy"];

describe("a swing's cut", () => {
  test("goes along its way, mirrored seen from in front", () => {
    for (const way of SWING_DIRS) {
      assert.deepEqual(wayCut(way), SCREEN_DIR[way], way);
      const seen = wayCut(way, true);
      assert.ok(Math.abs(seen.x + SCREEN_DIR[way].x) < 1e-9 && seen.y === SCREEN_DIR[way].y, `${way} mirrored`);
    }
  });

  test("a stab leaves no trail", () => {
    const { liveAt } = waySwingAt("stab", 0);
    assert.equal(trail(waySwingAt("stab", liveAt)), null);
    assert.notEqual(trail(waySwingAt("lr", liveAt)), null);
  });
});

describe("a swing's stroke and frames", () => {
  test("drawn back, then driven faster and faster to the hit, live, then following through", () => {
    const steps = swingSteps("light", "lr"), { driveAt, liveAt, liveUntil, endAt } = steps[0]!;
    const strokes = steps.map(strokeOf);
    assert.equal(strokes[0]!.set, 0);
    assert.equal(strokes[driveAt]!.set, 1);
    assert.ok(Math.abs(strokes[liveAt]!.turn - 1 / 3) < 1e-9 && Math.abs(strokes[liveUntil]!.turn - 2 / 3) < 1e-9);
    assert.equal(strokeOf({ ...steps[0]!, step: endAt }).turn, 1);
    const turned = strokes.map((s) => s.turn);
    assert.deepEqual(turned, [...turned].sort((a, b) => a - b), "never back");
  });

  test("wound up while drawn back and slow to start, striking around the hit, then following through", () => {
    const steps = swingSteps("light", "lr"), frames = steps.map(swingFrame);
    const { driveAt, liveAt, liveUntil } = steps[0]!;
    assert.deepEqual(frames, [...frames].sort(), "in order");
    assert.equal(frames[(driveAt + liveAt) >> 1], 0, "halfway through the drive it has barely moved");
    assert.equal(frames[liveAt], 1);
    assert.equal(frames.at(-1), 2);
    assert.ok(frames.indexOf(2) >= liveUntil);
  });
});

describe("the sword trail", () => {
  test("is left from the drive through the hit, fading out over the follow-through", () => {
    for (const attack of KINDS) {
      for (const way of SWING_DIRS) {
        const steps = swingSteps(attack, way), shown = steps.map(trail), { driveAt, liveAt, liveUntil } = steps[0]!;
        const first = shown.findIndex((v) => v !== null), last = shown.length - 1 - [...shown].reverse().findIndex((v) => v !== null);
        assert.ok(first > driveAt && first < liveAt, `${attack} ${way} starts in the drive`);
        assert.ok(shown.slice(first, last + 1).every((v) => v !== null), `${attack} ${way} unbroken`);
        assert.ok(shown.slice(first, liveUntil).every((v) => v === 1), `${attack} ${way} whole while live`);
        assert.ok(shown[last]! < shown[liveUntil]!, `${attack} ${way} fades`);
      }
    }
    assert.equal(trail(null), null);
  });

  test("a slower swing (a heavier blade) draws its trail as much slower", () => {
    const slowed = (swing: SwingData): SwingData => ({
      ...swing, step: swing.step * 2, driveAt: swing.driveAt * 2, liveAt: swing.liveAt * 2,
      liveUntil: swing.liveUntil * 2, endAt: swing.endAt * 2,
    });
    const steps = swingSteps("light", "lr");
    assert.deepEqual(steps.map((swing) => trail(slowed(swing))), steps.map(trail));
  });
});

describe("a held blade", () => {
  test("winds up from the guard to where its cut starts, then sweeps through straight ahead to the other end", () => {
    const cut = wayCut("lr");
    const start = windup(cut, 1, held(cut)).blade, mid = strokeBlade(cut, 0.5).blade, end = strokeBlade(cut, 1).blade;
    assert.ok(start.x > 0.5 && end.x < -0.5, "across, the way it goes");
    assert.ok(mid.z > 0.9, "straight ahead halfway");
  });

  test("aimed, it's held out toward where its cut starts, up and ahead from the top", () => {
    for (const way of SWING_DIRS) {
      const cut = wayCut(way), guard = held(cut).blade, start = windup(cut, 1, held(cut)).blade;
      assert.ok(guard.x * start.x + guard.y * start.y > 0.5, way);
    }
    assert.ok(held(wayCut("tb")).blade.y > 0.7);
  });

  test("the wind-up starts from where the blade is held", () => {
    const from = held(wayCut("rl"));
    for (const way of SWING_DIRS) near(windup(wayCut(way), 0, from).blade, from.blade, way);
  });
});

describe("a stab's wind-up", () => {
  test("draws the hand back with the blade level, pointing ahead", () => {
    const from = held(wayCut("tb", true)), wound = windup(wayCut("stab", true), 1, from);
    assert.ok(wound.handZ < from.handZ - 0.3, `hand drawn back to ${wound.handZ}`);
    assert.ok(wound.blade.z > 0.99, "pointing ahead");
    assert.ok(strokeBlade(wayCut("stab", true), 0.5).handZ > wound.handZ, "then thrust forward");
  });
});

describe("the blade's cue", () => {
  test("glints just before the blade goes live, brightest as it does, gone soon after", () => {
    for (const attack of KINDS) {
      const steps = swingSteps(attack, "lr"), { liveAt, liveUntil } = steps[0]!, glints = steps.map(glintOf);
      assert.equal(glints[0], 0, `${attack}: not as it starts`);
      assert.ok(glints[liveAt - 2]! > 0 && glints[liveAt - 2]! < glints[liveAt]!, `${attack}: rising`);
      assert.equal(glints[liveAt], 1);
      assert.equal(glints[liveUntil], 0, `${attack}: gone while it's still live`);
    }
    assert.equal(glintOf(null), 0);
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
