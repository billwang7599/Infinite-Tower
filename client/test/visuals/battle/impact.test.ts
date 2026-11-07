import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Body, FIXED_DT, newWielder, Wielder, World, type Entity, type Vec3 } from "@infinite-tower/shared";
import {
  clash, HIT_STOP_EASE_MS, HIT_STOP_MS, heldSwing, hitStopKickRad, impactPose, JOLT_M, joltOf, parried, strike,
  type HitStop, type Impact, type Swung,
} from "../../../src/visuals/battle/impact.js";
import type { ArenaScene } from "../../../src/visuals/battle/scene.js";
import { wayCut } from "../../../src/visuals/battle/weapons.js";
import { swingAt } from "../../fixtures/swings.js";

const len = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
const AWAY = { x: 0, y: 0, z: 1 }, RIGHT = { x: 1, y: 0, z: 0 };
const STEPS_PER_MS = 1 / (1000 * FIXED_DT);
const END_MS = HIT_STOP_MS + HIT_STOP_EASE_MS;

describe("hit-stop: the attacker's blade holds, the fight runs on", () => {
  const swing = swingAt("light", "lr", 0), contactStep = swing.liveAt + 0.4;
  const live = (ms: number): Swung => ({ swing, step: contactStep + ms * STEPS_PER_MS });

  test("its swing is drawn where it was at contact for HIT_STOP_MS, while the fight's goes on", () => {
    const stop: HitStop = { ageMs: 0 };
    for (let ms = 0; ms < HIT_STOP_MS; ms++) {
      stop.ageMs = ms;
      assert.deepEqual(heldSwing(stop, live(ms), null), { swing, step: contactStep }, `${ms} ms`);
    }
  });

  test("then it catches up with the fight's swing without a jump, and is back in step after HIT_STOP_EASE_MS", () => {
    const stop: HitStop = { ageMs: 0 };
    let was = heldSwing(stop, live(0), null)!.step;
    for (let ms = 1; ms <= END_MS + 20; ms++) {
      stop.ageMs = ms;
      const now = heldSwing(stop, live(ms), null)!.step;
      assert.ok(now >= was, `never back at ${ms} ms`);
      assert.ok(now - was <= 3 * STEPS_PER_MS, `no faster than 3 times its own pace at ${ms} ms: ${now - was}`);
      was = now;
    }
    stop.ageMs = END_MS;
    assert.equal(heldSwing(stop, live(END_MS), null)!.step, live(END_MS).step);
  });

  test("it holds where it was drawn last frame, so a second contact while it catches up doesn't jump ahead", () => {
    const stop: HitStop = { ageMs: 0 }, drawn = { swing, step: contactStep + 1 };
    assert.deepEqual(heldSwing(stop, live(100), drawn), drawn);
  });

  test("a swing the fight ended at contact (a block, a parry) is held, then let go to ease back as any end", () => {
    const stop: HitStop = { ageMs: 0 }, last = live(0);
    assert.deepEqual(heldSwing(stop, null, last), last);
    stop.ageMs = HIT_STOP_MS - 1;
    assert.deepEqual(heldSwing(stop, null, last), last);
    stop.ageMs = HIT_STOP_MS + 1;
    assert.equal(heldSwing(stop, null, last), null);
  });

  test("nothing drawn at contact, nothing held; and a new swing goes ahead at once", () => {
    const none: HitStop = { ageMs: 0 };
    assert.equal(heldSwing(none, null, null), null);
    none.ageMs = 10;
    const next = { swing: swingAt("light", "rl", 0), step: 1 };
    assert.deepEqual(heldSwing(none, next, null), next);
    const stop: HitStop = { ageMs: 0 };
    heldSwing(stop, live(0), null);
    stop.ageMs = 10;
    assert.deepEqual(heldSwing(stop, next, live(10)), next);
  });

  test("without a hit-stop the fight's swing is drawn as it is", () => {
    assert.deepEqual(heldSwing(undefined, live(30), live(10)), live(30));
    assert.equal(heldSwing(undefined, null, live(10)), null);
  });

  test("the camera kicks a touch for the stop, then settles back", () => {
    const at = (ageMs: number) => hitStopKickRad({ ageMs });
    assert.equal(hitStopKickRad(undefined), 0);
    assert.ok(at(0) > 0 && at(0) < Math.PI / 180, "under a degree");
    assert.equal(at(HIT_STOP_MS - 1), at(0));
    assert.ok(at(HIT_STOP_MS + HIT_STOP_EASE_MS / 2) < at(0) && at(HIT_STOP_MS + HIT_STOP_EASE_MS / 2) > 0);
    assert.equal(at(END_MS), 0);
  });
});

describe("weapon contact: whose drawing it touches", () => {
  function fighters() {
    const world = new World(), body = (z: number) => ({ pos: { x: 0, y: 0.9, z }, vel: { x: 0, y: 0, z: 0 },
      centerHeight: 0.9, collider: 0 });
    const armed = (e: Entity, z: number) => {
      world.add(e, Body, body(z));
      world.add(e, Wielder, {
        ...newWielder({ rightHand: "sword", leftHand: null, active: "rightHand" }, 0.7), swing: swingAt("light", "lr", 6),
      });
    };
    const [by, target, other] = [world.spawn(), world.spawn(), world.spawn()];
    armed(by, 0);
    armed(target, 1.5);
    armed(other, 4);
    const sparks = () => {};
    const scene = {
      battle: { view: { eye: { x: 0, y: 1.6, z: -0.2 }, at: { x: 0, y: 1.2, z: 3 } } }, impacts: new Map(),
      hitStops: new Map(), skills: { bursts: { sparks, parry: sparks, guardBroken: sparks } },
    } as unknown as ArenaScene;
    const fight = () => JSON.stringify([[...world.query(Body)], [...world.query(Wielder)]]);
    return { world, scene, by, target, other, fight };
  }

  test("a hit holds only the attacker; the target's jolt starts at once, and the fight is left as it was", () => {
    const { world, scene, by, target, other, fight } = fighters(), before = fight();
    strike(scene, world, by, target);
    assert.deepEqual([...scene.hitStops.keys()], [by]);
    assert.deepEqual([...scene.impacts.keys()], [target]);
    assert.ok(len(impactPose({ ...scene.impacts.get(target)!, ageMs: 16 }).offset) > 0, "jolted on the next frame");
    assert.equal(scene.hitStops.has(other) || scene.impacts.has(other), false);
    assert.equal(fight(), before);
  });

  test("a blocked blade holds; a parry holds both blades", () => {
    const blocked = fighters();
    clash(blocked.scene, blocked.world, blocked.by, blocked.target);
    assert.deepEqual([...blocked.scene.hitStops.keys()], [blocked.by]);
    const parry = fighters(), before = parry.fight();
    parried(parry.scene, parry.world, parry.target, parry.by);
    assert.deepEqual([...parry.scene.hitStops.keys()].sort(), [parry.by, parry.target].sort());
    assert.equal(parry.fight(), before);
  });

  test("an arrow's hit holds nobody", () => {
    const { world, scene, by, target } = fighters();
    strike(scene, world, by, target, { x: 0, y: 1, z: 1.2 });
    assert.equal(scene.hitStops.size, 0);
  });
});

describe("the jolt of a hit", () => {
  test("pushes out and back along its push at once, then is done", () => {
    const push = { x: 0.2, y: 0, z: 0 };
    const at = (ageMs: number) => impactPose({ ageMs, push, pushMs: 100 } satisfies Impact);
    assert.ok(Math.abs(at(50).offset.x - push.x) < 1e-9, "all the way out halfway through");
    assert.ok(at(25).offset.x > 0 && at(25).offset.x < push.x);
    assert.ok(at(100).offset.x < 1e-9, "back where it was");
    assert.equal(at(100).done, true);
    assert.equal(at(60).done, false);
  });

  test("goes away from the attacker and the way the cut went across the screen", () => {
    const lr = joltOf(wayCut("lr"), AWAY, RIGHT), rl = joltOf(wayCut("rl"), AWAY, RIGHT);
    const tb = joltOf(wayCut("tb"), AWAY, RIGHT);
    assert.ok(lr.x > 0 && lr.z > 0, `lr ${JSON.stringify(lr)}`);
    assert.ok(rl.x < 0 && rl.z > 0, `rl ${JSON.stringify(rl)}`);
    assert.ok(tb.y < 0 && Math.abs(tb.x) < 1e-9, `tb ${JSON.stringify(tb)}`);
    for (const v of [lr, rl, tb]) assert.ok(Math.abs(len(v) - JOLT_M) < 1e-9);
  });

  test("an attack gone by pushes straight away", () => {
    const v = joltOf(null, AWAY, RIGHT);
    assert.ok(Math.abs(v.z - JOLT_M) < 1e-9 && Math.abs(v.x) < 1e-9 && Math.abs(v.y) < 1e-9);
  });
});
