import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NullEngine, Quaternion, Scene, StandardMaterial, TransformNode, Vector3 } from "@babylonjs/core";
import {
  BASE_STATS, Body, Enemy, FighterStats, FIXED_DT, Health, newWielder, Skilled, WAYS, WeaponAttack, WEAPONS, Wielder,
  World, type EnemyData, type EnemyState, type Entity, type ItemId, type SkilledData, type SwingData, type Vec3,
  type WeaponAttackData,
} from "@infinite-tower/shared";
import { blocking } from "@infinite-tower/shared/fight";
import { Blend } from "../../../../src/modes/battle/context.js";
import { BLADE_FROM_M, holdingOf, holdShield, SHIELD } from "../../../../src/visuals/battle/blade.js";
import { guardPose } from "../../../../src/visuals/battle/guard.js";
import { HIT_STOP_MS, type HitStop } from "../../../../src/visuals/battle/impact.js";
import type { ArenaScene } from "../../../../src/visuals/battle/scene.js";
import { guardShiftTime } from "../../../../src/visuals/battle/person/animation.js";
import { ROUNDNESS } from "../../../../src/visuals/battle/person/loft.js";
import { MOTIONS, strokeOf, wayCut, WEAPON_LOOKS } from "../../../../src/visuals/battle/weapons.js";
import {
  GREATSWORD_BUILD, koboldGreatswordVisual,
} from "../../../../src/visuals/enemies/kobold-greatsword/animation.js";
import {
  koboldShieldbearerVisual, SHIELDBEARER_BUILD,
} from "../../../../src/visuals/enemies/kobold-shieldbearer/animation.js";
import {
  koboldSwordsmanVisual, koboldVisual, reachKobold,
} from "../../../../src/visuals/enemies/kobold-swordsman/animation.js";
import {
  bellySections, buildKobold, OFF_GRIP_M, SWORDSMAN_BUILD, torsoSections, type KoboldBuild,
} from "../../../../src/visuals/enemies/kobold-swordsman/model.js";
import { KOBOLD_GUARD_FIT, koboldPose } from "../../../../src/visuals/enemies/kobold-swordsman/pose.js";
import { alongSegment, armDepth, depthIn, type Loft } from "../../../fixtures/clearance.js";
import { swingAt, swingSteps } from "../../../fixtures/swings.js";

const TOLERANCE_M = 0.003;
const ARM_REACH_M = 0.8;

function deepest(
  build: KoboldBuild, weapon: "kobold-blade" | "kobold-greatsword", onGrip: number,
): { depthM: number; where: string } {
  const scene = new Scene(new NullEngine()), ctx = { scene, sky: { castShadows: () => {} } } as never;
  const look = WEAPON_LOOKS[weapon];
  const def = { radius: 0.5 } as never;
  const m = buildKobold(ctx, 1, new TransformNode("kobold", scene), def, 0, look, ARM_REACH_M, build);
  const lofts: Loft[] = [torsoSections(build.bulk), bellySections(build.bulk)].map((sections) => ({
    node: m.chest, sections, roundness: ROUNDNESS,
  }));
  const motion = MOTIONS.melee, held = motion.held(wayCut("tb", true));
  let worst = { depthM: 0, where: "" };
  const check = (
    what: string, state: EnemyState, t: number, k: number, swing: SwingData | null, gaitM = 0, guarded = 0,
  ) => {
    const p = koboldPose(state, t, k, wayCut(swing?.way ?? "tb", true), motion, swing && strokeOf(swing), held,
      swing?.attack === "heavy", { kind: "one", raised: guarded });
    m.hips.rotation.y = p.hipTwist;
    m.chest.rotation.set(p.bend, p.twist, 0);
    m.model.rotation.set(p.lean, 0, p.roll);
    m.model.position.y = p.yOff;
    const hand = m.swordArm.hand;
    hand.rotationQuaternion = new Quaternion();
    const blade = new Vector3(p.blade.x, p.blade.y, p.blade.z);
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), blade, hand.rotationQuaternion);
    reachKobold(m, p.hand, { ...p.offHand, z: p.offHand.z - gaitM }, look, onGrip * (1 - guarded));
    for (const [which, arm] of [["sword", m.swordArm], ["off", m.offArm]] as const) {
      const c = arm.clearance!, { depthM, part } = armDepth(lofts, arm, c, c.upperFrom);
      if (depthM > worst.depthM) worst = { depthM, where: `${which} ${part}, ${what}` };
    }
    hand.computeWorldMatrix(true);
    const edge = (y: number) => Vector3.TransformCoordinates(new Vector3(0, y, 0), hand.getWorldMatrix());
    for (const at of alongSegment(edge(BLADE_FROM_M), edge(BLADE_FROM_M + look.blade.lengthM), 20)) {
      const depthM = depthIn(lofts, at, look.blade.widthM / 2);
      if (depthM > worst.depthM) worst = { depthM, where: `the blade, ${what}` };
    }
  };
  check("on guard", "approach", 0.5, 0.5, null);
  for (const gaitM of [-0.17, 0.17]) check(`walking, the free hand ${gaitM} m`, "approach", 0.5, 0.5, null, gaitM);
  for (const guarded of [0.5, 1]) {
    for (const gaitM of [0, -0.17, 0.17]) {
      check(`blocking ${guarded}, the free hand ${gaitM} m`, "approach", 0.5, 0.5, null, gaitM, guarded);
    }
  }
  for (const state of ["stunned", "staggered", "dead"] as const) {
    for (const t of [0, 0.1, 0.3]) check(`${state} at ${t} s`, state, t, 0.5, null);
  }
  for (const attack of ["light", "heavy"] as const) {
    for (const way of WAYS) {
      for (const s of swingSteps(attack, way)) {
        const k = Math.min(1, s.step / s.endAt), what = `${attack} ${way} step ${s.step}`;
        check(what, s.step < s.liveUntil ? "weapon" : "weaponRecover", s.step * FIXED_DT, k, s);
        if (s.step < s.driveAt) check(`${what}, its tell`, "weaponWindup", s.step * FIXED_DT, s.step / s.driveAt, s);
      }
    }
  }
  scene.dispose();
  return worst;
}

describe("the kobolds' arms go round their bodies", () => {
  const kobolds = [[SWORDSMAN_BUILD, "kobold-blade"], [GREATSWORD_BUILD, "kobold-greatsword"]] as const;

  test("on guard, blocking, swinging either way, reeling and down, no arm, fist or blade passes into the torso", () => {
    for (const [build, weapon] of kobolds) {
      for (const onGrip of [0, 1]) {
        const { depthM, where } = deepest(build, weapon, onGrip);
        assert.ok(depthM <= TOLERANCE_M, `${weapon}, grip ${onGrip}: ${(depthM * 100).toFixed(1)} cm in, ${where}`);
      }
    }
  });

  test("blocking, its blade passes under its snout", () => {
    for (const [build, weapon] of kobolds) {
      const scene = new Scene(new NullEngine()), ctx = { scene, sky: { castShadows: () => {} } } as never;
      const look = WEAPON_LOOKS[weapon], cut = wayCut("tb", true);
      const m = buildKobold(ctx, 1, new TransformNode("kobold", scene), { radius: 0.5 } as never, 0, look,
        ARM_REACH_M, build);
      const p = koboldPose("approach", 0.5, 0.5, cut, MOTIONS.melee, null, MOTIONS.melee.held(cut), false,
        { kind: "one", raised: 1 });
      const hand = m.swordArm.hand;
      hand.rotationQuaternion = holdingOf(p.blade, p.edge, new Quaternion());
      reachKobold(m, p.hand, p.offHand, look, 0);
      const head = m.head.getChildMeshes().map((h) => {
        h.computeWorldMatrix(true);
        return h.getBoundingInfo().boundingBox;
      });
      const under = (at: Vector3) => head.filter((b) => at.x > b.minimumWorld.x && at.x < b.maximumWorld.x);
      const blade = (y: number) => Vector3.TransformCoordinates(new Vector3(0, y, 0), hand.computeWorldMatrix(true));
      for (const at of alongSegment(blade(BLADE_FROM_M), blade(BLADE_FROM_M + look.blade.lengthM), 40)) {
        for (const b of under(at)) {
          assert.ok(at.y + look.blade.widthM / 2 < b.minimumWorld.y, `${weapon}: ${at.y.toFixed(2)} m, its head over`);
        }
      }
      scene.dispose();
    }
  });
});

describe("a hit-stop on a kobold: its blade holds, then goes on with no jump", () => {
  const PER_SEC = 240;

  function run(contact: "hit" | "blocked" | null) {
    const scene = new Scene(new NullEngine()), world = new World(), e = world.spawn();
    world.add(e, Body, { pos: { x: 0, y: 0.9, z: 0 }, vel: { x: 0, y: 0, z: 0 }, centerHeight: 0.9, collider: 0 });
    world.add(e, Health, { hp: 30, max: 30, invuln: 0, hitstun: 0, flash: 0, regenDelay: 0, floor: 0 });
    world.add(e, Skilled, { chanting: false, casting: null } as unknown as SkilledData);
    world.add(e, FighterStats, BASE_STATS);
    const enemy = world.add(e, Enemy, { def: { radius: 0.5 }, state: "weapon", stateTime: 0, duration: 0.5, yaw: 0 } as
      unknown as EnemyData);
    const wielder = world.add(e, Wielder,
      newWielder({ rightHand: "kobold-blade", leftHand: null, active: "rightHand" }, ARM_REACH_M));
    const hitStops = new Map<Entity, HitStop>(), ctx = {
      scene, sky: { castShadows: () => {} }, nodes: new Map(), impacts: new Map(), hitStops, skills: {},
      materials: { slashFx: new StandardMaterial("slash", scene) }, battle: { blend: new Blend(), corrections: [] },
    } as unknown as ArenaScene;
    const drawn = koboldSwordsmanVisual.spawn(ctx, world, e), hand = drawn.drawing.swordArm.hand;
    const swing = swingAt("light", "lr", 0), contactAt = swing.liveAt + 1, frames = [];
    const tipM = BLADE_FROM_M + WEAPON_LOOKS["kobold-blade"].blade.lengthM;
    let struck = false, ended = false;
    for (let i = 0; i <= (swing.endAt * FIXED_DT + 0.3) * PER_SEC; i++) {
      const step = Math.floor(i / PER_SEC / FIXED_DT);
      if (!ended) swing.step = step;
      if (contact && step >= contactAt && !struck) {
        hitStops.set(e, { ageMs: 0 });
        struck = true;
        ended = contact === "blocked";
      }
      wielder.swing = !ended && step < swing.endAt ? swing : null;
      Object.assign(enemy, { state: wielder.swing ? "weapon" : "weaponRecover", stateTime: i / PER_SEC });
      koboldSwordsmanVisual.frame(drawn, world, e, 1 / PER_SEC);
      const at = hand.computeWorldMatrix(true);
      frames.push({
        grip: Vector3.TransformCoordinates(Vector3.Zero(), at),
        tip: Vector3.TransformCoordinates(new Vector3(0, tipM, 0), at),
        held: (hitStops.get(e)?.ageMs ?? Infinity) <= HIT_STOP_MS - 1000 / PER_SEC,
      });
    }
    scene.dispose();
    return frames;
  }

  const moved = (a: { grip: Vector3; tip: Vector3 }, b: { grip: Vector3; tip: Vector3 }) =>
    Math.max(Vector3.Distance(a.grip, b.grip), Vector3.Distance(a.tip, b.tip));

  for (const contact of ["hit", "blocked"] as const) {
    test(`a ${contact} swing`, () => {
      const free = run(null), stopped = run(contact);
      const fastest = Math.max(...free.slice(1).map((f, i) => moved(f, free[i]!)));
      const held = stopped.flatMap((f, i) => f.held ? [i] : []);
      assert.ok(held.length >= Math.floor((HIT_STOP_MS / 1000) * PER_SEC) - 2, `${held.length} frames held`);
      for (const i of held.slice(1)) assert.ok(moved(stopped[i]!, stopped[i - 1]!) < 1e-6, `still on frame ${i}`);
      for (let i = held[0]!; i < stopped.length; i++) {
        const m = moved(stopped[i]!, stopped[i - 1]!);
        assert.ok(m <= fastest, `${m.toFixed(3)} m on frame ${i}: a jump`);
      }
    });
  }
});

describe("a kobold raises its guard while its block is up", () => {
  const PER_SEC = 240, BLOCK_REACT_TIME = 0.3;
  const kobolds = [
    { visual: koboldSwordsmanVisual, weapon: "kobold-blade" },
    { visual: koboldGreatswordVisual, weapon: "kobold-greatsword" },
  ] as const;

  function run(
    { visual, weapon }: (typeof kobolds)[number], stunAt: number, blocks = true, strength = BASE_STATS.strength,
  ) {
    const scene = new Scene(new NullEngine()), world = new World(), e = world.spawn();
    world.add(e, Body, { pos: { x: 0, y: 0.9, z: 0 }, vel: { x: 0, y: 0, z: 0 }, centerHeight: 0.9, collider: 0 });
    world.add(e, Health, { hp: 30, max: 30, invuln: 0, hitstun: 0, flash: 0, regenDelay: 0, floor: 0 });
    world.add(e, Skilled, { chanting: false, casting: null } as unknown as SkilledData);
    world.add(e, FighterStats, { ...BASE_STATS, strength });
    const enemy = world.add(e, Enemy, { def: { radius: 0.5 }, state: "approach", stateTime: 0, duration: 0, yaw: 0 } as
      unknown as EnemyData);
    world.add(e, Wielder, newWielder({ rightHand: weapon, leftHand: null, active: "rightHand" }, ARM_REACH_M));
    const attack = { def: { blockReactTime: BLOCK_REACT_TIME } } as unknown as WeaponAttackData;
    if (blocks) world.add(e, WeaponAttack, attack);
    const ctx = {
      scene, sky: { castShadows: () => {} }, nodes: new Map(), impacts: new Map(), hitStops: new Map(), skills: {},
      materials: { slashFx: new StandardMaterial("slash", scene) }, battle: { blend: new Blend(), corrections: [] },
    } as unknown as ArenaScene;
    const drawn = visual.spawn(ctx, world, e), hand = drawn.drawing.swordArm.hand;
    const frames: { time: number; hand: Vector3 }[] = [];
    let upAt = Infinity;
    for (let i = 0; i <= 2 * PER_SEC; i++) {
      const time = i / PER_SEC;
      if (time >= stunAt && enemy.state === "approach") Object.assign(enemy, { state: "stunned", stateTime: 0 });
      if (blocking(world, e)) upAt = Math.min(upAt, time);
      visual.frame(drawn, world, e, 1 / PER_SEC);
      frames.push({ time, hand: hand.position.clone() });
      enemy.stateTime += 1 / PER_SEC;
    }
    scene.dispose();
    return { frames, upAt };
  }

  const { hand: guarded } = guardPose("one", 1, KOBOLD_GUARD_FIT) as { hand: Vec3 };
  const raised = new Vector3(guarded.x, guarded.y, guarded.z);
  const shareFrom = (plain: Vector3) => (at: Vector3) =>
    1 - Vector3.Distance(at, raised) / Vector3.Distance(plain, raised);
  const handAtTime = (frames: { time: number; hand: Vector3 }[], time: number) =>
    frames.find((f) => f.time >= time - 1e-9)!.hand;

  const STUN_AT = 1.5;
  const fastest = (frames: { time: number; hand: Vector3 }[], from: number, to: number) => Math.max(...frames
    .flatMap((f, i) => i > 0 && f.time > from && f.time < to ? [Vector3.Distance(f.hand, frames[i - 1]!.hand)] : []));

  for (const kobold of kobolds) {
    test(`${kobold.weapon}: up only once its block is, eased over its guard's shift by its raise time, never jumping`, () => {
      const { frames, upAt } = run(kobold, STUN_AT), unguarded = run(kobold, STUN_AT, false).frames;
      const shiftTime = guardShiftTime(WEAPONS[kobold.weapon]);
      const at = (time: number) => handAtTime(frames, time), share = shareFrom(handAtTime(unguarded, upAt));
      assert.ok(upAt > BLOCK_REACT_TIME - FIXED_DT && upAt < STUN_AT - 0.5, `up at ${upAt} s`);
      assert.ok(Vector3.Distance(at(upAt), handAtTime(unguarded, upAt)) < 0.01, "on guard until its block is up");
      assert.ok(share(at(upAt + shiftTime / 4)) < 0.4, `${share(at(upAt + shiftTime / 4))}: eased in, not snapped`);
      assert.ok(Vector3.Distance(at(upAt + shiftTime + 0.2), raised) < 0.01, "held where a block holds it");
      assert.ok(fastest(frames, 0, STUN_AT) < 0.012, `${fastest(frames, 0, STUN_AT).toFixed(3)} m in a frame`);
      assert.ok(share(at(STUN_AT + shiftTime / 4)) > 0.6, "eased out as it drops");
      const reeled = fastest(frames, STUN_AT, 2), fromGuard = fastest(unguarded, STUN_AT, 2);
      assert.ok(reeled <= fromGuard + 1e-3, `reeling from its block ${reeled} m a frame, from its guard ${fromGuard}`);
    });
  }

  const halfway = (kobold: (typeof kobolds)[number], strength = BASE_STATS.strength) => {
    const { frames, upAt } = run(kobold, STUN_AT, true, strength);
    const share = shareFrom(handAtTime(run(kobold, STUN_AT, false, strength).frames, upAt));
    return frames.find((f) => f.time > upAt && share(f.hand) >= 0.5)!.time - upAt;
  };

  test("a heavier blade's guard rises slower", () => {
    assert.ok(halfway(kobolds[1]) > halfway(kobolds[0]) + 0.01);
  });

  test("a weaker kobold's guard rises as fast: strength never changes a weapon's times", () => {
    assert.ok(Math.abs(halfway(kobolds[0], BASE_STATS.strength / 5) - halfway(kobolds[0])) < 0.01);
  });
});

describe("the Kobold Shieldbearer's shield", () => {
  const scene = () => new Scene(new NullEngine());

  test("is the 3D shield in its other hand, clear of its snout and chest, carried or raised", () => {
    const s = scene(), ctx = { scene: s, sky: { castShadows: () => {} } } as never, look = WEAPON_LOOKS["kobold-blade"];
    const m = buildKobold(ctx, 1, new TransformNode("kobold", s), { radius: 0.5 } as never, 0, look, ARM_REACH_M,
      SHIELDBEARER_BUILD);
    const shield = holdShield(ctx, m.offArm.hand, "wooden-shield");
    const lofts: Loft[] = [torsoSections(SHIELDBEARER_BUILD.bulk), bellySections(SHIELDBEARER_BUILD.bulk)].map(
      (sections) => ({ node: m.chest, sections, roundness: ROUNDNESS }));
    const cut = wayCut("tb", true);
    for (const raised of [0, 0.5, 1]) {
      const p = koboldPose("approach", 0.5, 0.5, cut, MOTIONS.melee, null, MOTIONS.melee.held(cut), false,
        { kind: "shield", raised });
      m.chest.rotation.set(p.bend, p.twist, 0);
      m.swordArm.hand.rotationQuaternion = holdingOf(p.blade, p.edge, new Quaternion());
      m.offArm.hand.rotationQuaternion = holdingOf(p.off!.blade, p.off!.edge, new Quaternion());
      reachKobold(m, p.hand, p.offHand, look);
      const head = m.head.getChildMeshes().map((h) => {
        h.computeWorldMatrix(true);
        return h.getBoundingInfo().boundingBox;
      });
      const at = shield.root.computeWorldMatrix(true);
      for (let i = 0; i < 24; i++) {
        for (const r of [SHIELD.radiusM, SHIELD.radiusM / 2]) {
          const a = (i / 24) * 2 * Math.PI, rim = Vector3.TransformCoordinates(
            new Vector3(r * Math.cos(a), 0, r * Math.sin(a)), at);
          const what = `${raised} raised, ${(a * 180 / Math.PI).toFixed(0)} degrees round`;
          assert.ok(depthIn(lofts, rim, SHIELD.thickM / 2) <= TOLERANCE_M, `${what}: in its chest`);
          for (const b of head) {
            const under = rim.x > b.minimumWorld.x && rim.x < b.maximumWorld.x && rim.z > b.minimumWorld.z
              && rim.z < b.maximumWorld.z;
            assert.ok(!under || rim.y < b.minimumWorld.y, `${what}: ${rim.y.toFixed(2)} m, into its head`);
          }
        }
      }
    }
    s.dispose();
  });

  test("its fight visual holds it, turned out at its side, and raises it to face its foe while its block is up", () => {
    const world = new World(), e = world.spawn(), s = scene();
    world.add(e, Body, { pos: { x: 0, y: 0.9, z: 0 }, vel: { x: 0, y: 0, z: 0 }, centerHeight: 0.9, collider: 0 });
    world.add(e, Health, { hp: 30, max: 30, invuln: 0, hitstun: 0, flash: 0, regenDelay: 0, floor: 0 });
    world.add(e, Skilled, { chanting: false, casting: null } as unknown as SkilledData);
    world.add(e, FighterStats, BASE_STATS);
    world.add(e, Enemy, { def: { radius: 0.5 }, state: "approach", stateTime: 0, duration: 0, yaw: 0 } as
      unknown as EnemyData);
    world.add(e, Wielder, newWielder({ rightHand: "kobold-blade", leftHand: "wooden-shield", active: "rightHand" },
      ARM_REACH_M));
    world.add(e, WeaponAttack, { def: { blockReactTime: 0.3 } } as unknown as WeaponAttackData);
    const ctx = {
      scene: s, sky: { castShadows: () => {} }, nodes: new Map(), impacts: new Map(), hitStops: new Map(), skills: {},
      materials: { slashFx: new StandardMaterial("slash", s) }, battle: { blend: new Blend(), corrections: [] },
    } as unknown as ArenaScene;
    const drawn = koboldShieldbearerVisual.spawn(ctx, world, e), hand = drawn.drawing.offArm.hand;
    const board = hand.getChildMeshes().find((m) => m.name === "shield-board");
    assert.ok(board, "a shield in its other hand");
    const facing = () => Vector3.TransformNormal(Vector3.Forward(), hand.computeWorldMatrix(true)).normalize();
    const step = (time: number) => {
      for (let t = 0; t < time; t += 1 / 60) {
        koboldShieldbearerVisual.frame(drawn, world, e, 1 / 60);
        world.require(e, Enemy).stateTime += 1 / 60;
      }
    };
    step(0.2);
    assert.ok(!blocking(world, e));
    const carried = facing();
    assert.ok(carried.z > 0.5 && carried.z < 0.95 && carried.x < -0.2, `carried facing ${carried}`);
    step(1);
    assert.ok(blocking(world, e));
    assert.ok(facing().z > 0.99, `raised facing ${facing()}`);
    s.dispose();
  });
});

describe("the kobold rig grips as gripOf says: both hands on a lone blade unless its hands are one-handed", () => {
  const PER_SEC = 120;

  function run(
    build: KoboldBuild, weapon: "kobold-blade" | "kobold-greatsword", leftHand: ItemId | null, oneHanded?: true,
  ) {
    const scene = new Scene(new NullEngine()), world = new World(), e = world.spawn();
    world.add(e, Body, { pos: { x: 0, y: 0.9, z: 0 }, vel: { x: 0, y: 0, z: 0 }, centerHeight: 0.9, collider: 0 });
    world.add(e, Health, { hp: 30, max: 30, invuln: 0, hitstun: 0, flash: 0, regenDelay: 0, floor: 0 });
    world.add(e, Skilled, { chanting: false, casting: null } as unknown as SkilledData);
    world.add(e, FighterStats, BASE_STATS);
    const enemy = world.add(e, Enemy, { def: { radius: 0.5 }, state: "approach", stateTime: 0, duration: 0, yaw: 0 } as
      unknown as EnemyData);
    const wielder = world.add(e, Wielder,
      newWielder({ rightHand: weapon, leftHand, active: "rightHand", ...(oneHanded && { oneHanded }) }, ARM_REACH_M));
    const ctx = {
      scene, sky: { castShadows: () => {} }, nodes: new Map(), impacts: new Map(), hitStops: new Map(), skills: {},
      materials: { slashFx: new StandardMaterial("slash", scene) }, battle: { blend: new Blend(), corrections: [] },
    } as unknown as ArenaScene;
    const visual = koboldVisual(build), drawn = visual.spawn(ctx, world, e), m = drawn.drawing;
    let worst = { m: 0, at: "" }, least = Infinity;
    const frame = (what: string) => {
      visual.frame(drawn, world, e, 1 / PER_SEC);
      const held = m.swordArm.hand.computeWorldMatrix(true), off = m.offArm.hand.computeWorldMatrix(true).getTranslation();
      const way = Vector3.TransformNormal(Vector3.Up(), held).normalize(), at = held.getTranslation();
      const underM = Vector3.Distance(off, at.subtract(way.scale(OFF_GRIP_M)));
      if (underM > worst.m) worst = { m: underM, at: what };
      least = Math.min(least, underM);
    };
    for (let i = 0; i < 0.3 * PER_SEC; i++) frame("on guard");
    for (const attack of ["light", "heavy"] as const) {
      for (const way of WAYS) {
        const swing = swingAt(attack, way, 0);
        for (let i = 0; i <= swing.endAt * FIXED_DT * PER_SEC; i++) {
          swing.step = Math.floor(i / PER_SEC / FIXED_DT);
          wielder.swing = swing.step < swing.endAt ? swing : null;
          Object.assign(enemy, { state: wielder.swing ? "weapon" : "weaponRecover", stateTime: i / PER_SEC });
          frame(`${attack} ${way} step ${swing.step}`);
        }
      }
    }
    scene.dispose();
    return { worst, least };
  }

  const oneBlade = [[SWORDSMAN_BUILD, "kobold-blade"], [GREATSWORD_BUILD, "kobold-greatsword"]] as const;

  test("the off hand stays on the hilt a hand-width under the sword hand, on guard and through every swing", () => {
    for (const [build, weapon] of oneBlade) {
      const { worst } = run(build, weapon, null);
      assert.ok(worst.m < 0.02, `${weapon}: ${worst.m.toFixed(3)} m off the grip at ${worst.at}`);
    }
  });

  test("with anything in the other hand it's free", () => {
    const { least } = run(SWORDSMAN_BUILD, "kobold-blade", "skillbook");
    assert.ok(least > OFF_GRIP_M, `${least} m from the grip`);
  });

  test("a one-handed wielder's off hand stays free, its other hand empty", () => {
    for (const [build, weapon] of oneBlade) {
      const { least } = run(build, weapon, null, true);
      assert.ok(least > OFF_GRIP_M, `${weapon}: ${least} m from the grip`);
    }
  });
});
