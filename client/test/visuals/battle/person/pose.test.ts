import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Matrix, Vector3 } from "@babylonjs/core";
import {
  DEFAULT_LOOK, FIXED_DT, PLAYER, SCREEN_DIR, SWING_DIRS, type SwingData, type SwingDir, type Vec3,
} from "@infinite-tower/shared";
import { BLADE_FROM_M } from "../../../../src/visuals/battle/blade.js";
import { personBuild } from "../../../../src/visuals/battle/person/model.js";
import { BREATH, strideOf, WALK } from "../../../../src/visuals/battle/person/motion.js";
import { M_PER_PX, restAt, restInModel } from "../../../../src/visuals/battle/person/skeleton.js";
import { HAIR_SHELL, HEAD } from "../../../../src/visuals/battle/person/head.js";
import { CAMERA_VIEWS } from "../../../../src/modes/battle/camera.js";
import { BLOCK } from "../../../../src/visuals/battle/guard.js";
import {
  CLIPS, KEY_EASE_TIME, keyed, legDrop, personPose, POSED_JOINTS, type PersonPose, type PosedJoint,
} from "../../../../src/visuals/battle/person/pose.js";
import { GUARD_LEAN, MOTIONS, WEAPON_LOOKS } from "../../../../src/visuals/battle/weapons.js";
import { playerDoing } from "../../../fixtures/players.js";
import { swingSteps } from "../../../fixtures/swings.js";

const BUILD = personBuild(DEFAULT_LOOK);
const AHEAD = { x: 0, z: 1 };
/** A running leg's knee folds past square as it swings through. */
const KNEE_MOST_RAD = 2;
const ATTACKING = playerDoing("attack", 0);
const EASE_STEPS = Math.ceil(KEY_EASE_TIME / FIXED_DT);

type Extra = Parameters<typeof personPose>[3];
const pose = (
  player = playerDoing("none", 0), swing: SwingData | null = null, extra: Partial<Extra> = {},
): PersonPose => personPose(player, { swing }, MOTIONS.melee, {
  build: BUILD, side: 1, alive: true, dodge: { x: 0, z: 1 }, stagger: { left: 0, of: 0 }, deadTime: 0, time: 0,
  walk: { phase: 0, speed: 0, way: AHEAD }, ...extra,
});
const close = (a: number, b: number, what: string) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} vs ${b}`);
const lean = (p: PersonPose) => p.joints.root.x;
const roll = (p: PersonPose) => p.joints.root.z;
const crouch = (p: PersonPose) => -p.joints["thigh.R"].x;
const twist = (p: PersonPose) => p.joints.hips.y + p.joints.spine.y + p.joints.chest.y;
/** About two of the arena's low-res pixels at the shoulder camera's distance. */
const BOW_CLEAR_M = 0.04;

describe("keyed poses", () => {
  test("each key is eased into over the whole gap to the next: most of the way at once, then creeping, never held", () => {
    const at = [0, 1], values = [0, 10, 4];
    assert.equal(keyed(0, at, values), 0);
    assert.ok(keyed(KEY_EASE_TIME, at, values) > 5, "most of the way quickly");
    let last = keyed(KEY_EASE_TIME, at, values);
    for (let t = 2 * KEY_EASE_TIME; t < 1; t += KEY_EASE_TIME) {
      const now = keyed(t, at, values);
      assert.ok(now > last + 0.05 && now < 10, `still creeping toward the key at ${t}: ${now}`);
      last = now;
    }
    close(keyed(1, at, values), 10, "there on the next key");
    assert.equal(keyed(-1, at, values), 0);
  });

  test("the last key is eased into until the clip's end, else over the ease, then held", () => {
    const at = [0, 1], values = [0, 10, 4];
    const toEnd = keyed(1.5, at, values, 2);
    assert.ok(toEnd < 10 && toEnd > 4);
    close(keyed(2, at, values, 2), 4, "at the end");
    close(keyed(1 + KEY_EASE_TIME, at, values), 4, "no end: over the ease");
    assert.equal(keyed(5, at, values), 4);
  });

  test("nothing jumps, even between keys closer than the ease", () => {
    for (const at of [[0, 1], [0, KEY_EASE_TIME / 3, KEY_EASE_TIME / 2]]) {
      const values = [0, 10, 4, 7], dt = 1e-4;
      for (let t = -0.01; t < 1.2; t += dt) {
        const jump = Math.abs(keyed(t + dt, at, values, 1.1) - keyed(t, at, values, 1.1));
        assert.ok(jump < 0.1, `${JSON.stringify(at)}: ${jump} in ${dt} s at ${t}`);
      }
    }
  });
});

const angleRad = (a: Vec3, b: Vec3) => Math.acos(Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));

describe("the 3D player's swing", () => {
  for (const attack of ["light", "heavy"] as const) {
    test(`a ${attack} never stops: the wind-up creeps back, the cut sweeps through and follows on past`, () => {
      const steps = swingSteps(attack, "lr"), { driveAt, liveAt, endAt } = steps[0]!;
      const at = (step: number) => pose(ATTACKING, steps[step]!, { alpha: 1 });
      const along: number[] = [];
      for (let step = 1; step < endAt; step++) {
        const { x, z } = at(step).blade, a = Math.atan2(z, -x), last = along.at(-1) ?? a;
        along[step] = last + Math.atan2(Math.sin(a - last), Math.cos(a - last));
      }
      for (let step = EASE_STEPS + 1; step < driveAt - 1; step++) {
        assert.ok(along[step + 1]! < along[step]!, `${attack}: creeping back at step ${step}`);
      }
      for (let step = driveAt + 2; step < endAt - Math.ceil((endAt - liveAt) / 8); step++) {
        assert.ok(along[step + 1]! > along[step]! + 0.004, `${attack}: sweeping round at step ${step}`);
      }
      for (let step = driveAt + 2; step < endAt - 1; step++) {
        assert.ok(along[step + 1]! > along[step]!, `${attack}: still going round at step ${step}`);
      }
      assert.ok(at(driveAt).blade.z < 0, "drawn back behind");
      assert.ok(Math.abs(at(liveAt).blade.x) < 0.05 && at(liveAt).blade.z > 0.9, "straight ahead on the hit");
      assert.ok(at(endAt - 1).blade.x > 0.5 && at(endAt - 1).blade.z < 0, "followed through past the right");
      assert.equal(at(driveAt).swing?.set, 1, "taken over");
      assert.ok(lean(at(1)) < 0 && lean(at(1)) > lean(at(EASE_STEPS)), "eased into");
    });
  }

  test("drawn between the fight's steps: a share of the way to the next", () => {
    const steps = swingSteps("light", "lr"), { driveAt, liveAt } = steps[0]!;
    for (const step of [3, driveAt + 2, liveAt]) {
      const before = pose(ATTACKING, steps[step]!, { alpha: 1 }), after = pose(ATTACKING, steps[step + 1]!, { alpha: 0 });
      assert.deepEqual(before.blade, after.blade, `step ${step}`);
      const half = pose(ATTACKING, steps[step + 1]!, { alpha: 0.5 }).blade;
      const whole = angleRad(before.blade, pose(ATTACKING, steps[step + 1]!, { alpha: 1 }).blade);
      assert.ok(angleRad(before.blade, half) > whole * 0.2 && angleRad(before.blade, half) < whole * 0.8, `${step}`);
    }
  });

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

const FORWARD: Vec3 = { x: 0, y: 0, z: 1 };
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 =>
  ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const along = (p: Vec3, d: Vec3, m: number): Vec3 => ({ x: p.x + d.x * m, y: p.y + d.y * m, z: p.z + d.z * m });
const length = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
const planeOf = (way: SwingDir): Vec3 => cross(FORWARD, { x: -SCREEN_DIR[way].x, y: -SCREEN_DIR[way].y, z: 0 });
const faceOf = (held: { blade: Vec3; edge: Vec3 }) => cross(held.edge, held.blade);

function closest(a0: Vec3, a: Vec3, b0: Vec3, b: Vec3): { m: number; at: Vec3; ta: number; tb: number } {
  const w = sub(a0, b0), ab = dot(a, b), d = dot(a, w), e = dot(b, w), den = 1 - ab * ab;
  const ta = (ab * e - d) / den, tb = (e - ab * d) / den, p = along(a0, a, ta), q = along(b0, b, tb);
  return { m: length(sub(p, q)), at: { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, z: (p.z + q.z) / 2 }, ta, tb };
}

describe("the 3D player's guard and block", () => {
  test("aimed, the blade lies in its cut's plane and its edge faces the foe ahead, either hand", () => {
    const most = Math.max(...Object.values(GUARD_LEAN));
    for (const side of [1, -1] as const) {
      for (const way of SWING_DIRS) {
        const p = pose(playerDoing("none", 1, way), null, { side }), plane = planeOf(way), what = `${side} ${way}`;
        assert.ok(p.edge, `${what}: an edge`);
        assert.ok(Math.abs(dot(p.blade, plane)) < 1e-9 && Math.abs(dot(p.edge, plane)) < 1e-9, `${what}: in plane`);
        assert.ok(dot(p.edge, FORWARD) >= Math.cos(most) - 1e-9, `${what}: the edge ${dot(p.edge, FORWARD)} ahead`);
        assert.deepEqual(p.held, { way, block: null }, what);
      }
    }
  });

  test("swinging, the blade's flat lies in the cut's plane, its edge leading from the drive into the hit and past", () => {
    for (const attack of ["light", "heavy"] as const) {
      for (const way of SWING_DIRS) {
        const steps = swingSteps(attack, way), { liveAt, endAt } = steps[0]!;
        for (let step = 1; step < endAt - 1; step++) {
          for (const alpha of [0.25, 0.75]) {
            const now = pose(ATTACKING, steps[step]!, { alpha }), next = pose(ATTACKING, steps[step]!, { alpha: alpha + 0.05 });
            const moved = sub(next.blade, now.blade), what = `${attack} ${way} step ${step}`;
            if (length(moved) < 1e-4) continue;
            assert.ok(now.edge && Math.abs(dot(now.edge, moved)) > 0.95 * length(moved), `${what}: along its way`);
            if (step >= liveAt - 2) assert.ok(dot(now.edge, moved) > 0, `${what}: leading`);
          }
        }
      }
    }
  });

  const blocking = (guard: "one" | "dual" | "shield", side: 1 | -1 = 1, twoHanded = false) =>
    pose(playerDoing("block", 1, "rl"), null, { side, guard, twoHanded });

  test("one blade blocks held across the body, its edge out, the other hand under it, or with it on the grip", () => {
    const lengthM = WEAPON_LOOKS.sword.blade.lengthM;
    for (const side of [1, -1] as const) {
      for (const twoHanded of [false, true]) {
        const p = blocking("one", side, twoHanded), what = `${side}${twoHanded ? " two-handed" : ""}`;
        assert.ok(Math.abs(p.blade.x) > 0.85 && p.blade.x * side < 0, `${what}: across, toward the other side`);
        assert.ok(p.edge && dot(p.edge, FORWARD) > 0.8, `${what}: the edge toward the foe`);
        assert.deepEqual(p.held, { way: "rl", block: "one" });
        assert.equal(p.gripped, twoHanded, `${what}: on the grip`);
        if (twoHanded) {
          assert.ok(Math.abs(p.hand.x) < BUILD.shoulderM && p.hand.z > 0.15, `${what}: the hilt before the chest`);
          continue;
        }
        assert.ok(p.hand.x * side > 0 && p.hand.z > 0.15, `${what}: the sword hand out ahead on its own side`);
        const ta = dot(sub(p.offHand, p.hand), p.blade), m = length(sub(p.offHand, along(p.hand, p.blade, ta)));
        assert.ok(ta > BLADE_FROM_M + 0.1 && ta < BLADE_FROM_M + lengthM / 2, `${what}: the other hand ${ta} m along`);
        assert.ok(m < 0.07 && p.offHand.y < along(p.hand, p.blade, ta).y, `${what}: under the blade, ${m} m off`);
      }
    }
  });

  test("a blade alone is held in both hands, but the off hand lets go to chant, cast, write, eat or rummage", () => {
    for (const action of ["none", "attack", "block", "dodge", "stagger"] as const) {
      assert.equal(pose(playerDoing(action, 0.5), null, { guard: "one", twoHanded: true }).gripped, true, action);
    }
    for (const action of ["chant", "cast", "beam", "write", "use", "bag"] as const) {
      assert.equal(pose(playerDoing(action, 0.5), null, { guard: "one", twoHanded: true }).gripped, false, action);
    }
    assert.equal(pose(playerDoing("none", 0.5), null, { guard: "one" }).gripped, false, "one-handed");
    assert.equal(pose(playerDoing("none", 0.5), null, { twoHanded: true, alive: false }).gripped, false, "down");
  });

  test("two blades block crossed in an X, edges out, meeting above the hands without passing through", () => {
    for (const side of [1, -1] as const) {
      const p = blocking("dual", side), off = p.off!;
      assert.ok(off, "the other blade held");
      assert.ok(p.blade.x * side < -0.3 && off.blade.x * side > 0.3, `${side}: each leaning across to the other side`);
      assert.ok(p.blade.y > 0.5 && off.blade.y > 0.5, `${side}: both up`);
      assert.ok(p.hand.x * side > 0 && p.offHand.x * side < 0, `${side}: a hand either side`);
      assert.ok(dot(p.edge!, FORWARD) > 0.7 && dot(off.edge, FORWARD) > 0.7, `${side}: both edges toward the foe`);
      const x = closest(p.hand, p.blade, p.offHand, off.blade);
      assert.ok(Math.abs(x.m - BLOCK.dual.crossM) < 0.01, `${side}: ${x.m} m apart where they cross`);
      assert.ok(x.at.y > Math.max(p.hand.y, p.offHand.y) + 0.1 && Math.abs(x.at.x) < 0.05, `${side}: crossed above`);
      assert.ok(x.ta > BLADE_FROM_M && x.tb > BLADE_FROM_M, `${side}: on the blades`);
    }
    for (const id of ["sword", "kobold-blade", "longsword"] as const) {
      assert.ok(BLOCK.dual.crossM >= WEAPON_LOOKS[id].blade.widthM, `${id}: edges out, they'd pass through`);
    }
  });

  test("a shield blocks raised in front, facing the foe, the blade kept in its guard", () => {
    for (const side of [1, -1] as const) {
      const p = blocking("shield", side), carried = pose(playerDoing("none", 1, "rl"), null, { side, guard: "shield" });
      assert.ok(p.off && dot(faceOf(p.off), FORWARD) > 0.95 && p.off.blade.y > 0.9, `${side}: upright, facing ahead`);
      assert.ok(p.offHand.y > carried.offHand.y + 0.15 && p.offHand.z > carried.offHand.z, `${side}: raised`);
      assert.ok(p.offHand.z > BUILD.reachM * 0.7, `${side}: out before the chest`);
      assert.ok(Math.abs(p.offHand.x) < BUILD.shoulderM, `${side}: in front of the body`);
      assert.deepEqual(p.blade, carried.blade, `${side}: the sword's guard kept`);
      assert.ok(carried.off && dot(faceOf(carried.off), FORWARD) > 0.5, `${side}: carried facing ahead, turned out`);
    }
  });

  test("a second blade is held at the other side, point up and ahead, out from the body", () => {
    for (const side of [1, -1] as const) {
      const p = pose(playerDoing("none", 1, "rl"), null, { side, guard: "dual" });
      assert.ok(p.off && p.off.blade.y > 0.3 && p.off.blade.z > 0.5 && p.off.blade.x * side < 0, `${side}`);
      assert.ok(dot(p.off.edge, FORWARD) > 0.5, `${side}: its edge toward the foe`);
    }
    assert.equal(pose(playerDoing("none", 1, "rl"), null, { guard: "one" }).off, null);
  });
});

describe("the 3D player's other actions", () => {
  test("a dodge plays its clip: crouched and leaning the way it goes at once, still going, then recovering", () => {
    const at = (t: number, dodge = { x: 0, z: 1 }) => pose(playerDoing("dodge", t), null, { dodge });
    const keyAt = CLIPS.dodge.at[1], launched = at(keyAt), keys = CLIPS.dodge.joints;
    close(lean(launched), keys.root.x[1], "leaning ahead");
    close(launched.joints["thigh.L"].z, keys["thigh.L"].z[1], "legs apart");
    assert.ok(crouch(launched) > 0.5, "crouched");
    assert.ok(lean(at(KEY_EASE_TIME)) > keys.root.x[1] * 0.6, "most of the way at once");
    assert.ok(lean(at(keyAt / 2)) < lean(launched) - 0.01, "still going, not held");
    assert.ok(crouch(at(PLAYER.dodge.duration * 0.95)) < crouch(launched), "recovering");
    const right = at(keyAt, { x: 1, z: 0 });
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

  test("walking, the upper body holds each key of the stride and eases between", () => {
    const step = (2 * Math.PI) / WALK.at.length, held = WALK.easeShare + 0.05;
    const hips = (phase: number) => pose(undefined, null, { walk: { phase, speed: 3, way: AHEAD } }).joints.hips.y;
    assert.equal(hips(step * (1 + held)), hips(step * 1.95));
    assert.notEqual(hips(step * 1.01), hips(step * 1.95));
  });

  const stride = (share: number, speed: number = PLAYER.moveSpeed, way = AHEAD) =>
    pose(undefined, null, { walk: { phase: share * 2 * Math.PI, speed, way } });
  const held = (key: number) => WALK.at[key]! + 0.9 / WALK.at.length;

  const jointAt = (p: PersonPose, chain: readonly PosedJoint[]) => {
    let m = Matrix.Identity();
    for (const j of chain) {
      const r = p.joints[j], at = j === "root" ? { x: 0, y: p.rootY, z: 0 } : restAt(j, BUILD.look.body);
      m = m.multiply(Matrix.RotationYawPitchRoll(r.y, r.x, r.z).multiply(Matrix.Translation(at.x, at.y, at.z)));
    }
    return Vector3.TransformCoordinates(Vector3.Zero(), m);
  };
  const footAt = (p: PersonPose, leg: "R" | "L") =>
    jointAt(p, [`foot.${leg}`, `shin.${leg}`, `thigh.${leg}`, "hips", "root"]);

  test("a stride: the legs take turns, the body bobs, the hips and shoulders turn against each other", () => {
    const { duty } = strideOf(PLAYER.moveSpeed, 0);
    const contact = stride(0), other = stride(0.5), passing = stride(duty / 2);
    const hipsZ = jointAt(contact, ["hips", "root"]).z;
    assert.ok(footAt(contact, "L").z > hipsZ + 0.1 && footAt(contact, "R").z < hipsZ, "left foot ahead, right behind");
    assert.ok(Math.abs(footAt(other, "R").z - footAt(contact, "L").z) < 0.01, "half a stride later, the right");
    assert.ok(passing.joints["shin.R"].x > 0.5, "the passing leg's knee lifts");
    assert.ok(stride(duty / 2 + 0.25).rootY > passing.rootY, "up between steps, down over the planted foot");
    assert.ok(stride(held(0)).joints.hips.y * stride(held(0)).joints.chest.y < 0, "hips and shoulders counter-turn");
    assert.ok(stride(held(0)).offHand.z < stride(held(2)).offHand.z, "the left arm back as the left leg goes ahead");
    assert.ok(contact.joints.root.x > 0, "leaning into it");
    assert.ok(stride(0, PLAYER.moveSpeed, { x: 0, z: -1 }).joints.root.x < 0, "backing off, leaning back");
    assert.equal(contact.legsExact, true);
  });

  test("a slower walk is a shorter stride", () => {
    assert.ok(Math.abs(stride(0, 1.5).joints["thigh.L"].x) < Math.abs(stride(0).joints["thigh.L"].x));
  });

  test("a planted foot stays put on the ground as the body goes over it, whichever way it goes", () => {
    const ground = restInModel("foot.L", BUILD.look.body).y;
    const runs = [[1.5, AHEAD], [PLAYER.moveSpeed, AHEAD], [4, { x: 0.6, z: -0.8 }], [3, { x: 1, z: 0 }]] as const;
    for (const [speed, way] of runs) {
      const s = strideOf(speed, Math.abs(way.x)), spots: Vector3[] = [];
      for (let share = 0.01; share < s.duty - 0.01; share += s.duty / 10) {
        const p = stride(share, speed, way), foot = footAt(p, "L"), t = share / s.cyclesPerSec;
        spots.push(foot.add(new Vector3(way.x * speed * t, 0, way.z * speed * t)));
        assert.ok(Math.abs(foot.y - ground) < 0.003, `${speed} m/s: on the ground, ${foot.y}`);
      }
      const slidM = Math.max(...spots.map((at) => Vector3.Distance(at, spots[0]!)));
      assert.ok(slidM < 0.01, `${speed} m/s along ${JSON.stringify(way)}: slid ${slidM} m`);
    }
  });

  test("touching down the knees give and come back", () => {
    const land = (landing: number) => pose(undefined, null, { landing });
    assert.ok(land(0.5).rootY < land(0).rootY - 0.01, "down");
    assert.ok(Math.abs(land(1).rootY - land(0).rootY) < 1e-9, "eased from the touch");
    const landingWalk = pose(undefined, null, { landing: 0.5, walk: { phase: 0, speed: 3, way: AHEAD } });
    assert.ok(stride(0, 3).rootY > landingWalk.rootY, "walking too");
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
    const poses = [pose(), pose(playerDoing("dodge", KEY_EASE_TIME)), pose(playerDoing("block", 1))];
    for (let share = 0; share < 1; share += 0.05) poses.push(stride(share), stride(share, 1.5));
    for (const steps of [swingSteps("light", "lr"), swingSteps("heavy", "rl")]) {
      for (const s of steps) poses.push(pose(ATTACKING, s));
    }
    for (const p of poses) {
      for (const j of POSED_JOINTS) {
        const most = j.startsWith("shin") ? KNEE_MOST_RAD : Math.PI / 2;
        for (const v of Object.values(p.joints[j])) assert.ok(Math.abs(v) < most, `${j}: ${v}`);
      }
      const drop = (s: "R" | "L") => legDrop(p.joints[`thigh.${s}`], p.joints[`shin.${s}`]);
      const low = Math.min(drop("R"), drop("L")), ground = restInModel("foot.L", BUILD.look.body).y;
      if (p.legsExact) assert.ok(Math.min(footAt(p, "R").y, footAt(p, "L").y) > ground - 0.003, "no foot underground");
      else close(p.rootY, -low, "the lower foot down");
    }
  });
});

describe("the 3D player's bow", () => {
  const BOW = WEAPON_LOOKS["training-bow"].bow!;
  const bowPose = (player: ReturnType<typeof playerDoing>, drawn = 0, side: 1 | -1 = 1): PersonPose =>
    personPose(player, { swing: null }, MOTIONS.ranged, {
      build: BUILD, side, alive: true, dodge: { x: 0, z: 1 }, stagger: { left: 0, of: 0 }, deadTime: 0, time: 0,
      walk: { phase: 0, speed: 0, way: AHEAD }, bow: { ...BOW, drawn },
    });

  test("drawing, it's held out ahead at the shoulders, upright, the string hand pulling back with the draw", () => {
    const begun = bowPose(playerDoing("draw", 0.1), 0), half = bowPose(playerDoing("draw", 0.5), 0.5);
    const full = bowPose(playerDoing("draw", 1), 1);
    for (const p of [begun, half, full]) {
      assert.ok(p.hand.z > BUILD.reachM * 0.8, "out ahead");
      assert.ok(Math.abs(p.hand.y - BUILD.shoulderY) < 0.1, "at the shoulders");
      assert.ok(p.blade.y > 0.8, "upright, canted a little");
      close(p.offHand.x, p.hand.x, "on the string");
    }
    close(begun.offHand.z, begun.hand.z - BOW.braceM, "on the string at rest");
    close(full.offHand.z, full.hand.z - BOW.braceM - BOW.drawM, "pulled back all the way");
    close(half.offHand.z, half.hand.z - BOW.braceM - BOW.drawM / 2, "halfway");
    assert.ok(twist(full) < 0, "turned side-on, the bow arm ahead");
    assert.ok(full.joints["thigh.R"].x < 0 && full.joints["thigh.R"].z > 0 && full.joints["thigh.L"].z < 0,
      "feet planted apart, the bow side's ahead");
  });

  test("from the locked camera over the left shoulder, the whole bow shows past the body and head", () => {
    const { sideM, distanceM, orbitHeightM } = CAMERA_VIEWS.shoulder;
    const eye = { x: sideM, y: PLAYER.height / 2 + orbitHeightM, z: -distanceM };
    const halfM = WEAPON_LOOKS["training-bow"].blade.lengthM / 2;
    // The body (its backpack and arms too) and the hair, seen as a flat cut-out across its middle.
    const edgeAt = (y: number) => y > BUILD.headY - HEAD.y * M_PER_PX ? HEAD.x * HAIR_SHELL * M_PER_PX
      : BUILD.shoulderM + BUILD.armM / 2;
    const shown = { carried: bowPose(playerDoing("none", 1), 0, -1), nocked: bowPose(playerDoing("draw", 0), 0, -1),
      drawn: bowPose(playerDoing("draw", 1), 1, -1) };
    for (const [what, p] of Object.entries(shown)) {
      for (const t of [-1, -0.5, 0, 0.5, 1]) {
        const x = p.hand.x + p.blade.x * halfM * t, y = p.hand.y + p.blade.y * halfM * t;
        const z = p.hand.z + p.blade.z * halfM * t, k = -eye.z / (z - eye.z);
        assert.ok(y > 0, `${what}: above the ground`);
        if (z <= 0) continue;
        const crossX = eye.x + (x - eye.x) * k, crossY = eye.y + (y - eye.y) * k;
        assert.ok(crossX < -edgeAt(crossY) - BOW_CLEAR_M, `${what}: clear at ${t} of the way up`);
      }
    }
  });

  test("loosing, the body rocks back with the string's kick and settles", () => {
    const kick = bowPose(playerDoing("loose", KEY_EASE_TIME)), settled = bowPose(playerDoing("loose", 1));
    assert.ok(lean(kick) < lean(settled) && lean(kick) < lean(bowPose(playerDoing("draw", 1), 1)));
  });

  test("just loosed from a full draw, the string hand is still back by the face", () => {
    const p = bowPose(playerDoing("loose", 0.05), 1);
    assert.ok(p.offHand.z < p.hand.z - BOW.braceM - BOW.drawM / 2);
  });

  test("carried low at the side at rest, its top leaning out and ahead; across the chest to guard", () => {
    const carried = bowPose(playerDoing("none", 1)), left = bowPose(playerDoing("none", 1), 0, -1);
    assert.ok(carried.blade.x > 0 && carried.blade.z > 0 && carried.blade.y > 0.7, "upright, leaning out and ahead");
    assert.ok(left.blade.x < 0 && left.hand.x < 0, "in the left hand, leaning out to the left");
    assert.notDeepEqual(MOTIONS.ranged.rest.blade, MOTIONS.melee.rest.blade);
    assert.ok(carried.hand.y < BUILD.waistY, "down by the hip");
    assert.ok(carried.hand.x > BUILD.shoulderM, "out at the side");
    assert.ok(bowPose(playerDoing("block", 1)).blade.x < -0.5);
  });
});
