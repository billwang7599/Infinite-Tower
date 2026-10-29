import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  attackShape, followingBlade, PLAYER, restingBlade, reverseOf, SCREEN_DIR, SWING_DIRS, WEAPONS, type AttackKind,
  type SwingData, type SwingDir, type Vec3, type WeaponId,
} from "@infinite-tower/shared";
import { MOTIONS, swingFrame, WEAPON_LOOKS, type TrailPose } from "../../../src/visuals/battle/weapons.js";
import { swingSteps } from "../../fixtures/swings.js";

const { trail: trailPose, thrust: thrustPose, windup, stroke: strokeBlade, held } = MOTIONS.sword;
const GUARD = held(restingBlade());
const windupBlade = (attack: AttackKind, k: number) => windup(attack, k, GUARD);
const near = (a: Vec3, b: Vec3, msg: string) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-9, msg);
const STAB_RANGE = attackShape("stab", PLAYER.armReachM, WEAPONS.sword).range;

const trail = (aimYaw: number, dir: SwingDir): TrailPose[] =>
  swingSteps(dir, aimYaw).map(trailPose).filter((pose) => pose !== null);
/** Where on screen (seen from behind: x right, y up) the trail's growing tip is. */
const onScreen = (pose: TrailPose) => {
  const along = pose.from * (1 - 2 * pose.reach);
  return { x: along * Math.cos(pose.rollRad), y: along * Math.sin(pose.rollRad) };
};

describe("a swing's frames", () => {
  test("wound up while it's set and slow to start, mid-swing around impact, then following through", () => {
    const frames = swingSteps("lr").map(swingFrame), { driveAt, liveAt, liveUntil } = swingSteps("lr")[0]!;
    assert.deepEqual(frames, [...frames].sort(), "in order");
    assert.equal(frames[(driveAt + liveAt) >> 1], 0, "halfway through the drive it has barely moved");
    assert.equal(frames[liveAt], 1);
    assert.equal(frames.at(-1), 2);
    assert.ok(frames.indexOf(2) >= liveUntil);
  });
});

describe("the sword trail", () => {
  test("goes across the screen the way the swing goes, as the player sees it", () => {
    for (const dir of SWING_DIRS) {
      const poses = trail(0, dir);
      assert.ok(poses.length > 0, `${dir} shows a trail`);
      const from = onScreen(poses[0]!), to = onScreen(poses.at(-1)!);
      const move = { x: to.x - from.x, y: to.y - from.y }, len = Math.hypot(move.x, move.y);
      const want = SCREEN_DIR[dir];
      assert.ok(len > 1.5, `${dir} goes from one end of its line to the other`);
      assert.ok((move.x * want.x + move.y * want.y) / len > 0.99, `${dir} goes ${JSON.stringify(move)}`);
    }
  });

  test("a slower swing (a heavier blade, a weaker arm) draws its trail and thrust as much slower", () => {
    const slowed = (swing: SwingData): SwingData => ({
      ...swing, step: swing.step * 2, driveAt: swing.driveAt * 2, liveAt: swing.liveAt * 2,
      liveUntil: swing.liveUntil * 2, letGoAt: swing.letGoAt * 2, endAt: swing.endAt * 2,
    });
    for (const kind of ["lr", "stab"] as const) {
      const steps = swingSteps(kind);
      const show = (swing: SwingData) => kind === "stab" ? thrustPose(swing, STAB_RANGE) : trailPose(swing);
      assert.deepEqual(steps.map((swing) => show(slowed(swing))), steps.map(show), kind);
    }
  });

  test("each swing's reverse goes back the same way along the same line", () => {
    const line = (dir: SwingDir) => trail(0, dir)[0]!.rollRad;
    for (const dir of SWING_DIRS) {
      assert.equal(line(reverseOf(dir)), line(dir), dir);
      assert.deepEqual(SCREEN_DIR[reverseOf(dir)], { x: -SCREEN_DIR[dir].x || 0, y: -SCREEN_DIR[dir].y || 0 });
    }
  });

  test("a swing draws the same trail, around its own aim, whatever that aim is", () => {
    const [first, ...rest] = [0, 0.8, -1.5].map((yaw) => trail(yaw, "lr"));
    rest.forEach((poses, i) => assert.deepEqual(poses, first, `aim ${i + 2} is like the first`));
  });

  test("the stab draws no trail but a thrust, out as far as the weapon stabs and back, while its blade is live", () => {
    const stab = swingSteps("stab"), reach = STAB_RANGE;
    assert.equal(stab.map(trailPose).filter((pose) => pose !== null).length, 0);
    const thrusts = stab.map((swing) => thrustPose(swing, STAB_RANGE));
    thrusts.forEach((pose, step) => {
      if (step < stab[0]!.driveAt) assert.equal(pose, null, "not while it draws back");
    });
    assert.ok(thrusts.some((pose) => pose !== null && pose.reachM > 0.8 * reach), "it reaches out");
    assert.ok(thrusts.every((pose) => pose === null || pose.reachM <= reach));
    for (const dir of SWING_DIRS) assert.ok(swingSteps(dir).every((s) => thrustPose(s, STAB_RANGE) === null), dir);
  });
});

describe("a held blade", () => {
  test("winds up from guard to where its swing starts, then sweeps through straight ahead to the other end", () => {
    const start = windupBlade("lr", 1).blade, mid = strokeBlade("lr", 0.5).blade, end = strokeBlade("lr", 1).blade;
    assert.ok(start.x > 0.5 && end.x < -0.5, "across, the way it goes");
    assert.ok(mid.z > 0.9, "straight ahead halfway");
  });

  test("between swings it's held where the fight's blade stopped: where its swing ended, or the guard", () => {
    for (const dir of SWING_DIRS) {
      const stopped = held(followingBlade(dir, 0)), end = strokeBlade(dir, 1);
      near(stopped.blade, end.blade, dir);
      assert.equal(stopped.handZ, end.handZ);
    }
    assert.ok(GUARD.blade.y > 0.5 && GUARD.blade.z > 0.5, "the guard is up and ahead");
  });

  test("the next wind-up starts from where the blade is held and ends where its swing starts", () => {
    const out = held(followingBlade("lr", 0));
    for (const attack of ["lr", "rl", "tb", "stab"] as const) {
      near(windup(attack, 0, out).blade, out.blade, attack);
      near(windup(attack, 1, out).blade, windup(attack, 1, GUARD).blade, attack);
    }
  });

  test("a stab draws the hand back, then thrusts it out", () => {
    assert.ok(windupBlade("stab", 1).handZ < windupBlade("stab", 0).handZ);
    assert.ok(strokeBlade("stab", 0.5).handZ > windupBlade("stab", 0).handZ);
    const drawn = windupBlade("stab", 1).handZ;
    assert.ok(Math.abs(strokeBlade("stab", 0).handZ - drawn) < 1e-9, "on from where it drew back");
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
        if (WEAPONS[a].mass > WEAPONS[b].mass) assert.ok(la.widthM >= lb.widthM, `${a} vs ${b}: width`);
      }
    }
  });
});
