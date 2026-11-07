import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NullEngine, Quaternion, Scene, TransformNode, Vector3, type AbstractMesh } from "@babylonjs/core";
import {
  BASE_STATS, Body, DEFAULT_LOOK, FighterStats, FIXED_DT, Health, LOOK_OPTIONS, newWielder, Player, PLAYER, STRIKES,
  SWING_DIRS, WAYS, Wielder, World, type Entity, type Look, type PlayerData, type SwingData,
  type SwingDir, type WeaponId, type WielderData,
} from "@infinite-tower/shared";
import { CAMERA_VIEWS } from "../../../../src/modes/battle/camera.js";
import { orbitBack } from "../../../../src/modes/orbit.js";
import { BATTLE_BUILDS } from "../../../../src/gfx/look/body.js";
import { BLADE_FROM_M, holdingOf } from "../../../../src/visuals/battle/blade.js";
import { holdInView, restShoulders } from "../../../../src/visuals/battle/firstPerson.js";
import { HIT_STOP_EASE_MS, HIT_STOP_MS, type HitStop } from "../../../../src/visuals/battle/impact.js";
import {
  dropPerson, framePerson, handSide, newPerson, reachArms, reachWith, type PersonDrawing,
} from "../../../../src/visuals/battle/person/animation.js";
import { SHAPES } from "../../../../src/visuals/battle/person/body.js";
import { ROUNDNESS } from "../../../../src/visuals/battle/person/loft.js";
import {
  buildPerson, personBuild, toMetres, type PersonBuild,
} from "../../../../src/visuals/battle/person/model.js";
import { OFF_GRIP_M, personPose, POSED_JOINTS } from "../../../../src/visuals/battle/person/pose.js";
import type { ArenaScene } from "../../../../src/visuals/battle/scene.js";
import { M_PER_PX, type Joints } from "../../../../src/visuals/battle/person/skeleton.js";
import { MOTIONS, WEAPON_LOOKS } from "../../../../src/visuals/battle/weapons.js";
import type { Sky } from "../../../../src/visuals/sky/sky.js";
import { alongSegment, depthIn, loftSurface, type Loft } from "../../../fixtures/clearance.js";
import { playerDoing } from "../../../fixtures/players.js";
import { swingAt, swingSteps } from "../../../fixtures/swings.js";

const sky = { castShadows: (_m: AbstractMesh) => {} } as unknown as Sky;

describe("the hand a 3D person holds its weapon in", () => {
  test("a sword is in the hand it's equipped in; a bow always in the left, on the shoulder camera's side", () => {
    assert.equal(handSide({ rightHand: "sword", leftHand: null }, "sword"), 1);
    assert.equal(handSide({ rightHand: null, leftHand: "sword" }, "sword"), -1);
    assert.equal(handSide({ rightHand: "training-bow", leftHand: null }, "training-bow"), -1);
    assert.equal(handSide({ rightHand: "skillbook", leftHand: "training-bow" }, "training-bow"), -1);
    assert.equal(handSide({ rightHand: null, leftHand: null }, null), 1);
  });

  test("a shield is always in the other hand: alone in the right, the left is the sword hand", () => {
    assert.equal(handSide({ rightHand: "sword", leftHand: "wooden-shield" }, "sword"), 1);
    assert.equal(handSide({ rightHand: "wooden-shield", leftHand: "sword" }, "sword"), -1);
    assert.equal(handSide({ rightHand: "wooden-shield", leftHand: null }, null), -1);
    assert.equal(handSide({ rightHand: null, leftHand: "wooden-shield" }, null), 1);
  });
});


describe("the 3D person's arms", () => {
  test("bend so the hand lands on the pose's target and holds the blade its way, however the body is turned", () => {
    const scene = new Scene(new NullEngine());
    const { joints, holder } = buildPerson({ scene, sky }, 1, new TransformNode("player", scene), personBuild(DEFAULT_LOOK));
    holder.rotation.y = 0.7;
    joints.root.rotation.set(0.3, 0, -0.2);
    joints.spine.rotation.y = -0.4;
    joints.chest.rotation.x = 0.2;
    const target = new Vector3(0.25, 0.9, 0.35), blade = new Vector3(0.3, 0.8, 0.5).normalize();
    const holding = new Quaternion();
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), blade, holding);
    reachWith(joints, "medium", "R", target, holding, { x: 0.5, y: -0.8, z: -0.45 });
    const root = joints.root.getWorldMatrix(), hand = joints["hand.R"];
    const want = Vector3.TransformCoordinates(target, root), got = hand.getAbsolutePosition();
    assert.ok(Vector3.Distance(want, got) < 1e-4, `${want} vs ${got}`);
    const along = Vector3.Up().applyRotationQuaternion(hand.absoluteRotationQuaternion);
    const wantAlong = Vector3.TransformNormal(blade, root).normalize();
    assert.ok(Vector3.Dot(along, wantAlong) > 0.9999, `${along} vs ${wantAlong}`);
    scene.dispose();
  });
});

/** How far (m) an arm, hand or blade may sink into the torso's skin. */
const TOLERANCE_M = 0.003;
const TORSO = ["ribs", "belly", "pelvis"] as const;
const LIMBS = [["upperArm", "upper_arm"], ["forearm", "forearm"], ["hand", "hand"]] as const;
const SAMPLE_M = 0.01;

interface Case {
  what: string; player: PlayerData; swing?: SwingData; extra?: Partial<Moment>; weapon: WeaponId | null;
  offWeapon?: WeaponId;
}
type Moment = Parameters<typeof personPose>[3];

function cases(swingEvery: number): Case[] {
  const all: Case[] = [];
  const add = (what: string, player: PlayerData, extra: Partial<Moment> = {}, weapon: WeaponId | null = "sword") =>
    all.push({ what, player, extra, weapon });
  for (let time = 0; time < 3.4; time += 0.85) add(`idle at ${time} s`, playerDoing("none", 1), { time });
  for (const way of [null, ...WAYS.filter((w) => w !== "stab")]) add(`guard ${way}`, playerDoing("none", 1, way));
  for (const speed of [1, PLAYER.moveSpeed]) {
    for (const way of [{ x: 0, z: 1 }, { x: 0, z: -1 }, { x: 1, z: 0 }, { x: -1, z: 0 }]) {
      for (let share = 0; share < 1; share += 1 / 8) {
        add(`walking ${speed} m/s ${JSON.stringify(way)} at ${share}`, playerDoing("none", 0),
          { walk: { phase: share * 2 * Math.PI, speed, way } });
      }
    }
  }
  for (const way of [null, ...WAYS.filter((w) => w !== "stab")]) {
    all.push({ what: `two-handed guard ${way}`, player: playerDoing("none", 1, way), extra: { twoHanded: true },
      weapon: "sword" });
  }
  for (const [weapon, attacks] of [["sword", ["light", "heavy"]], ["greatsword", ["heavy"]]] as const) {
    for (const attack of attacks) {
      for (const way of WAYS) {
        for (const swing of swingSteps(attack, way).filter((s) => s.step % swingEvery === 0)) {
          for (const twoHanded of [false, true]) {
            all.push({ what: `${weapon} ${attack} ${way} step ${swing.step}${twoHanded ? " two-handed" : ""}`,
              player: playerDoing("attack", 0), swing, weapon, extra: { twoHanded } });
          }
        }
      }
    }
  }
  for (let t = 0; t < PLAYER.dodge.duration; t += 0.05) {
    for (const dodge of [{ x: 0, z: 1 }, { x: 1, z: 0 }, { x: -1, z: 0 }]) {
      add(`dodge ${JSON.stringify(dodge)} at ${t}`, playerDoing("dodge", t), { dodge });
    }
  }
  for (const t of [0.03, 1]) {
    for (const action of ["block", "chant", "cast", "beam", "write", "use", "bag"] as const) {
      add(`${action} at ${t}`, playerDoing(action, t));
    }
  }
  for (const guard of ["one", "dual", "shield"] as const) {
    const offWeapon = guard === "dual" ? "kobold-blade" as const : undefined;
    for (const way of ["rl", "lr", "tb", "brtl"] as const) {
      for (const action of ["none", "block"] as const) {
        all.push({ what: `${guard} ${action} ${way}`, player: playerDoing(action, 1, way), extra: { guard }, weapon: "sword",
          offWeapon });
      }
    }
  }
  for (const twoHanded of [false, true]) {
    all.push({ what: `greatsword block${twoHanded ? " two-handed" : ""}`, player: playerDoing("block", 1, "rl"),
      extra: { guard: "one", twoHanded }, weapon: "greatsword" });
  }
  for (const left of [0.8, 0.4, 0.1]) {
    add(`staggered, ${left} s left`, playerDoing("stagger", 0.1), { stagger: { left, of: 0.8 } });
  }
  for (const deadTime of [0.1, 0.4, 2]) add(`down ${deadTime} s`, playerDoing("none", 0), { alive: false, deadTime });
  add("in the air", { ...playerDoing("none", 0), grounded: false });
  add("landing", playerDoing("none", 0), { landing: 0.5 });
  const bow = WEAPON_LOOKS["training-bow"].bow!;
  const shooting = (what: string, player: PlayerData, drawn: number) =>
    add(what, player, { bow: { ...bow, drawn } }, "training-bow");
  shooting("bow carried", playerDoing("none", 1), 0);
  for (const drawn of [0, 0.5, 1]) shooting(`bow drawn ${drawn}`, playerDoing("draw", 1), drawn);
  for (const t of [0, 0.05, 1]) shooting(`bow loosed ${t} s`, playerDoing("loose", t), 1);
  shooting("bow guard", playerDoing("block", 1), 0);
  return all;
}

function place(joints: Joints, build: PersonBuild, side: 1 | -1, c: Case): void {
  const swing = c.swing ?? null, player = swing ? playerDoing("attack", swing.step * FIXED_DT) : c.player;
  const held = c.weapon && WEAPON_LOOKS[c.weapon], alive = c.extra?.alive ?? true;
  const p = personPose(player, { swing }, MOTIONS[held?.bow ? "bow" : "sword"], {
    build, side, alive, dodge: { x: 0, z: 1 }, stagger: { left: 0, of: 0 },
    deadTime: 0, time: 0, walk: { phase: 0, speed: 0, way: { x: 0, z: 1 } }, ...c.extra,
  });
  for (const name of POSED_JOINTS) joints[name].rotation.set(p.joints[name].x, p.joints[name].y, p.joints[name].z);
  joints.root.position.y = p.rootY;
  const turn = holdingOf(p.blade, p.edge, new Quaternion());
  const offTurn = p.off ? holdingOf(p.off.blade, p.off.edge, new Quaternion()) : Quaternion.Identity();
  const hand = new Vector3(p.hand.x, p.hand.y, p.hand.z), offHeld = c.offWeapon ? WEAPON_LOOKS[c.offWeapon] : null;
  reachArms(joints, build.look.body, side, hand, turn, { hand: p.offHand, holding: offTurn, held: offHeld },
    alive ? held : null, p.gripped ? 1 : 0);
  for (const j of Object.values(joints)) j.computeWorldMatrix(true);
}

function deepestIn(body: Look["body"], swingEvery: number, twoHanded: boolean): { depthM: number; where: string } {
  const scene = new Scene(new NullEngine()), b = BATTLE_BUILDS[body];
  const build = personBuild({ ...DEFAULT_LOOK, body });
  const { joints } = buildPerson({ scene, sky }, 1, new TransformNode("player", scene), build);
  const inMetres = (part: keyof typeof SHAPES) => SHAPES[part].sections(b).map(toMetres);
  const torso: Loft[] = TORSO.map((part) => ({
    node: joints[SHAPES[part].joints[0]!], sections: inMetres(part), roundness: SHAPES[part].roundness ?? ROUNDNESS,
  }));
  // Above where the deltoid ends, the upper arm is the shoulder's joint, sunk into the chest.
  const jointEndM = SHAPES.shoulder.sections(b)[0]!.y * M_PER_PX;
  let worst = { depthM: 0, where: "" };
  for (const side of [1, -1] as const) {
    for (const c of cases(swingEvery).filter((c) => !!c.extra?.twoHanded === twoHanded)) {
      place(joints, build, side, c);
      const held = c.weapon && c.extra?.alive !== false ? WEAPON_LOOKS[c.weapon] : null;
      for (const s of ["R", "L"] as const) {
        const swordArm = (s === "R") === (side === 1);
        for (const [part, bone] of LIMBS) {
          const sections = inMetres(part), top = part === "upperArm" ? jointEndM : sections.at(-1)!.y;
          const points = loftSurface(sections, SHAPES[part].roundness ?? ROUNDNESS,
            joints[`${bone}.${s}`].getWorldMatrix(), sections[0]!.y, top, SAMPLE_M);
          for (const at of points) {
            const depthM = depthIn(torso, at);
            if (depthM > worst.depthM) worst = { depthM, where: `${swordArm ? "sword" : "off"} ${part}, ${c.what}` };
          }
        }
        const inHand = swordArm ? held : c.offWeapon && WEAPON_LOOKS[c.offWeapon];
        if (!inHand || inHand.bow) continue;
        const grip = joints[`grip.${s}`].getWorldMatrix();
        const edge = (y: number) => Vector3.TransformCoordinates(new Vector3(0, y, 0), grip);
        for (const at of alongSegment(edge(BLADE_FROM_M), edge(BLADE_FROM_M + inHand.blade.lengthM), 20)) {
          const depthM = depthIn(torso, at, inHand.blade.widthM / 2);
          if (depthM > worst.depthM) worst = { depthM, where: `the ${swordArm ? "" : "other "}blade, ${c.what}` };
        }
      }
    }
  }
  scene.dispose();
  return worst;
}

const TWO_HANDED_TOLERANCE_M = 0.075;

describe("the 3D person's arms go round its body", () => {
  test("in every pose no upper arm, forearm, hand or held blade passes into the torso, left- or right-handed", () => {
    for (const body of LOOK_OPTIONS.body) {
      const { depthM, where } = deepestIn(body, body === "medium" ? 1 : 3, false);
      assert.ok(depthM <= TOLERANCE_M, `${body}: ${(depthM * 100).toFixed(1)} cm in, ${where}`);
    }
  });

  test("a blade in both hands: the arms and blade sink no deeper than a little into the chest", () => {
    for (const body of LOOK_OPTIONS.body) {
      const { depthM, where } = deepestIn(body, body === "medium" ? 1 : 3, true);
      assert.ok(depthM <= TWO_HANDED_TOLERANCE_M, `${body}: ${(depthM * 100).toFixed(1)} cm in, ${where}`);
    }
  });
});

describe("switching hands with a blade in each", () => {
  const scene = new Scene(new NullEngine()), node = new TransformNode("player", scene), feet = { x: 2, y: 0.7, z: -1 };
  node.position.set(feet.x, feet.y, feet.z);
  const fp = CAMERA_VIEWS.fp, back = orbitBack(0, fp.lockPitchRad), o = { ...feet, y: feet.y + fp.orbitHeightM };
  const view = { yaw: 0, pitch: fp.lockPitchRad, fovRad: fp.fovRad,
    eye: { x: o.x + back.x * fp.distanceM, y: o.y + back.y * fp.distanceM, z: o.z + back.z * fp.distanceM },
    at: { x: o.x - back.x, y: o.y - back.y, z: o.z - back.z } };
  // A body just built eases in from its rest pose first.
  const SETTLED_TIME = 0.2, SWITCH_TIME = 0.3;

  function run(firstPerson: boolean, midSwing: boolean, perSec: number) {
    const world = new World(), e = world.spawn();
    const blend = { alpha: 1 }, ctx = { scene, sky, bows: new Map(), looks: new Map([[e, { current: DEFAULT_LOOK }]]),
      battle: { blend }, pixel: { steps: null }, hitStops: new Map() } as unknown as ArenaScene;
    world.add(e, Player, playerDoing("none", 0, "lr"));
    world.add(e, Body, { pos: { ...feet }, vel: { x: 0, y: 0, z: 0 }, centerHeight: 0.8, collider: 0 });
    world.add(e, Health, { hp: 100, max: 100, invuln: 0, hitstun: 0, flash: 0, regenDelay: 0, floor: 0 });
    world.add(e, FighterStats, BASE_STATS);
    const wielder = world.add(e, Wielder,
      newWielder({ rightHand: "sword", leftHand: "sword", active: "rightHand" }, PLAYER.armReachM));
    const p = newPerson(), swing = swingAt("light", "lr", 0);
    // Pressed mid-swing, a switch waits for the blade's live time to end.
    const swingFrom = SWITCH_TIME - (swing.liveUntil + 2) * FIXED_DT;
    let handM = 0, last: Vector3[] | null = null, kept = true, held: unknown[] = [];
    for (let i = 0; i <= 0.8 * perSec; i++) {
      const t = i / perSec, clock = (t - swingFrom) / FIXED_DT;
      if (t >= SWITCH_TIME && wielder.hands.active === "rightHand") {
        held = [p.blade, p.offBlade];
        wielder.hands = { ...wielder.hands, active: "leftHand" };
      }
      swing.step = Math.floor(clock) + 1;
      blend.alpha = clock - Math.floor(clock);
      wielder.swing = midSwing && clock >= 0 && swing.step <= swing.endAt ? swing : null;
      if (firstPerson) restShoulders(p);
      framePerson(p, ctx, node, world, e, 1 / perSec, { action: wielder.swing ? "attack" : "none", actionTime: 0,
        actionDir: { x: 0, z: 1 }, way: "lr", grounded: true, aim: { x: 0, z: 1 } }, { left: 0, of: 0 });
      if (firstPerson) holdInView(p, view, 1, 1 / perSec);
      if (held.length) kept &&= p.blade === held[1] && p.offBlade === held[0];
      const grips = (["grip.R", "grip.L"] as const).map((g) =>
        p.model!.joints[g].computeWorldMatrix(true).getTranslation());
      if (last && t > SETTLED_TIME) handM = Math.max(handM, ...grips.map((g, k) => Vector3.Distance(g, last![k]!)));
      last = grips;
    }
    dropPerson(p);
    return { handM, kept };
  }

  test("each hand keeps its blade, and both ease to their new places, at rest or mid-swing, in first person or not", () => {
    for (const firstPerson of [true, false]) {
      for (const midSwing of [false, true]) {
        const what = `${firstPerson ? "first" : "third"} person${midSwing ? ", mid-swing" : ""}`;
        const at60 = run(firstPerson, midSwing, 60), at240 = run(firstPerson, midSwing, 240);
        assert.ok(at60.kept, `${what}: the blades were rebuilt`);
        assert.ok(at240.handM < at60.handM / 2.5, `${what}: ${at60.handM} m a frame at 60 fps, ${at240.handM} at 240`);
      }
    }
  });
});

describe("a hit-stop on a 3D person: its arms and blade hold, then go on with no jump", () => {
  const PER_SEC = 240, dt = 1 / PER_SEC, view = {
    yaw: 0, pitch: 0, fovRad: CAMERA_VIEWS.fp.fovRad, eye: { x: 0, y: 1.6, z: -0.1 }, at: { x: 0, y: 1.3, z: 3 },
  };

  function run(contact: "hit" | "blocked" | null, firstPerson: boolean) {
    const scene = new Scene(new NullEngine()), world = new World(), e = world.spawn();
    world.add(e, Body, { pos: { x: 0, y: 0.9, z: 0 }, vel: { x: 0, y: 0, z: 0 }, centerHeight: 0.9, collider: 0 });
    world.add(e, Health, { hp: 100, max: 100, invuln: 0, hitstun: 0, flash: 0, regenDelay: 0, floor: 0 });
    world.add(e, FighterStats, BASE_STATS);
    const wielder = world.add(e, Wielder, newWielder({ rightHand: "sword", leftHand: null, active: "rightHand" }, 0.7));
    const blend = { alpha: 1 }, hitStops = new Map<Entity, HitStop>();
    const ctx = { scene, sky, bows: new Map(), looks: new Map([[e, { current: DEFAULT_LOOK }]]),
      pixel: { steps: null }, battle: { blend }, hitStops } as unknown as ArenaScene;
    const node = new TransformNode("player", scene), p = newPerson(), swing = swingAt("light", "lr", 0);
    const contactAt = swing.liveAt + 1, frames: { s: number; grip: Vector3; tip: Vector3; held: boolean }[] = [];
    let ended = false;
    for (let i = 0; i <= (swing.endAt * FIXED_DT + 0.4) * PER_SEC; i++) {
      const clock = i / PER_SEC / FIXED_DT, step = Math.floor(clock);
      blend.alpha = clock - step;
      const s = step - 1 + blend.alpha;
      if (!ended) swing.step = step;
      if (contact && s >= contactAt && !hitStops.has(e)) {
        hitStops.set(e, { ageMs: 0 });
        ended = contact === "blocked";
      } else {
        const stop = hitStops.get(e);
        if (stop) stop.ageMs += dt * 1000;
      }
      wielder.swing = !ended && step < swing.endAt ? swing : null;
      if (firstPerson) restShoulders(p);
      framePerson(p, ctx, node, world, e, dt, { ...playerDoing(wielder.swing ? "attack" : "none", 0, "lr"),
        aim: { x: 0, z: 1 } }, { left: 0, of: 0 });
      if (firstPerson) holdInView(p, view, 1, dt);
      const grip = p.model!.joints["grip.R"].computeWorldMatrix(true);
      frames.push({ s, grip: Vector3.TransformCoordinates(Vector3.Zero(), grip),
        tip: Vector3.TransformCoordinates(new Vector3(0, BLADE_FROM_M + WEAPON_LOOKS.sword.blade.lengthM, 0), grip),
        held: (hitStops.get(e)?.ageMs ?? Infinity) < HIT_STOP_MS });
    }
    scene.dispose();
    return frames;
  }

  const moved = (a: { grip: Vector3; tip: Vector3 }, b: { grip: Vector3; tip: Vector3 }) =>
    Math.max(Vector3.Distance(a.grip, b.grip), Vector3.Distance(a.tip, b.tip));

  for (const firstPerson of [true, false]) {
    for (const contact of ["hit", "blocked"] as const) {
      test(`${firstPerson ? "first person" : "its body"}, a ${contact} swing`, () => {
        const free = run(null, firstPerson), stopped = run(contact, firstPerson);
        const fastest = Math.max(...free.slice(1).map((f, i) => moved(f, free[i]!)));
        const held = stopped.flatMap((f, i) => f.held ? [i] : []);
        assert.ok(held.length >= Math.floor((HIT_STOP_MS / 1000) * PER_SEC) - 1, `${held.length} frames held`);
        for (const i of held.slice(1)) {
          assert.ok(moved(stopped[i]!, stopped[i - 1]!) < 1e-6, `still at ${stopped[i]!.s.toFixed(2)}`);
        }
        for (let i = held[0]!; i < stopped.length; i++) {
          const m = moved(stopped[i]!, stopped[i - 1]!);
          assert.ok(m <= 3 * fastest, `${m.toFixed(3)} m in a frame at ${stopped[i]!.s.toFixed(2)}: a jump`);
        }
        if (contact === "hit") {
          // The body's joints ease after the pose, so it's back in step a little later.
          const after = held.at(-1)! + Math.ceil(((HIT_STOP_EASE_MS + (firstPerson ? 0 : 100)) / 1000) * PER_SEC) + 2;
          assert.ok(moved(stopped[after]!, free[after]!) < (firstPerson ? 1e-6 : 0.002), "back in step with the fight");
        }
      });
    }
  }
});

describe("a lone blade is held in both hands", () => {
  const scene = new Scene(new NullEngine()), node = new TransformNode("player", scene), feet = { x: 2, y: 0.7, z: -1 };
  node.position.set(feet.x, feet.y, feet.z);
  const fp = CAMERA_VIEWS.fp, back = orbitBack(0, fp.lockPitchRad), o = { ...feet, y: feet.y + fp.orbitHeightM };
  const view = { yaw: 0, pitch: fp.lockPitchRad, fovRad: fp.fovRad,
    eye: { x: o.x + back.x * fp.distanceM, y: o.y + back.y * fp.distanceM, z: o.z + back.z * fp.distanceM },
    at: { x: o.x - back.x, y: o.y - back.y, z: o.z - back.z } };
  const SETTLED_TIME = 0.3, ON_GRIP_M = 0.02;

  function fighter(hands: WielderData["hands"], firstPerson: boolean) {
    const world = new World(), e = world.spawn();
    const blend = { alpha: 1 }, ctx = { scene, sky, bows: new Map(), looks: new Map([[e, { current: DEFAULT_LOOK }]]),
      battle: { blend }, pixel: { steps: null }, hitStops: new Map() } as unknown as ArenaScene;
    world.add(e, Player, playerDoing("none", 0));
    world.add(e, Body, { pos: { ...feet }, vel: { x: 0, y: 0, z: 0 }, centerHeight: 0.8, collider: 0 });
    world.add(e, Health, { hp: 100, max: 100, invuln: 0, hitstun: 0, flash: 0, regenDelay: 0, floor: 0 });
    world.add(e, FighterStats, BASE_STATS);
    const wielder = world.add(e, Wielder, newWielder(hands, PLAYER.armReachM)), p = newPerson();
    const frame = (dt: number, action: PlayerData["action"], way: SwingDir | null, swing: SwingData | null = null,
      alpha = 1) => {
      wielder.swing = swing;
      blend.alpha = alpha;
      if (firstPerson) restShoulders(p);
      framePerson(p, ctx, node, world, e, dt, { action, actionTime: 1, actionDir: { x: 0, z: 1 }, way, grounded: true,
        aim: { x: 0, z: 1 } }, { left: 0, of: 0 });
      if (firstPerson) holdInView(p, view, 1, dt);
    };
    return { p, wielder, frame };
  }

  function grips(p: PersonDrawing) {
    const [main, off] = (p.bladeSide === 1 ? ["grip.R", "grip.L"] as const : ["grip.L", "grip.R"] as const)
      .map((g) => p.model!.joints[g].computeWorldMatrix(true));
    const at = main!.getTranslation(), way = Vector3.TransformNormal(Vector3.Up(), main!).normalize();
    return { main: at, off: off!.getTranslation(), underM: Vector3.Distance(off!.getTranslation(),
      at.subtract(way.scale(OFF_GRIP_M))) };
  }

  function script(frame: ReturnType<typeof fighter>["frame"], perSec: number, each: (what: string) => void) {
    const dt = 1 / perSec, hold = (time: number, action: PlayerData["action"], way: SwingDir | null) => {
      for (let i = 0; i < time * perSec; i++) {
        frame(dt, action, way);
        each(`${action} ${way}`);
      }
    };
    hold(SETTLED_TIME, "none", null);
    for (const way of SWING_DIRS) hold(0.15, "none", way);
    for (const strike of STRIKES) {
      for (const way of strike === "stab" ? ["stab" as const] : SWING_DIRS) {
        const s = swingAt(strike === "heavy" ? "heavy" : "light", way, 0), stance = way === "stab" ? null : way;
        for (let clock = 0; clock < s.endAt; clock += 1 / perSec / FIXED_DT) {
          s.step = Math.floor(clock) + 1;
          frame(dt, "attack", stance, s, clock % 1);
          each(`${strike} ${way} step ${s.step}`);
        }
        hold(0.15, "none", stance);
      }
    }
    hold(0.3, "block", "rl");
  }

  test("the off hand is on the hilt a hand-width under the sword hand: guards, swings, stabs, blocks, either hand", () => {
    for (const firstPerson of [false, true]) {
      for (const hand of ["rightHand", "leftHand"] as const) {
        const f = fighter({ rightHand: hand === "rightHand" ? "sword" : null,
          leftHand: hand === "leftHand" ? "sword" : null, active: hand }, firstPerson);
        let worst = { m: 0, at: "" }, t = 0;
        script(f.frame, 120, (what) => {
          const { underM } = grips(f.p);
          if ((t += 1 / 120) > SETTLED_TIME && underM > worst.m) worst = { m: underM, at: what };
        });
        assert.ok(worst.m < ON_GRIP_M,
          `${firstPerson ? "first" : "third"} person, ${hand}: ${worst.m.toFixed(3)} m off the grip at ${worst.at}`);
        dropPerson(f.p);
      }
    }
  });

  test("with anything in the other hand it's free, as one-handed", () => {
    for (const firstPerson of [false, true]) {
      const f = fighter({ rightHand: "sword", leftHand: "skillbook", active: "rightHand" }, firstPerson);
      let nearest = Infinity, t = 0;
      script(f.frame, 60, () => {
        const { main, off } = grips(f.p);
        if ((t += 1 / 60) > SETTLED_TIME) nearest = Math.min(nearest, Vector3.Distance(main, off));
      });
      assert.ok(nearest > 2 * OFF_GRIP_M, `${firstPerson ? "first" : "third"} person: ${nearest} m from the sword hand`);
      dropPerson(f.p);
    }
  });

  test("taking up or putting down the other hand's thing eases the hand onto or off the grip, at rest or mid-swing", () => {
    const CHANGE_TIME = 0.4, END_TIME = 0.9;
    type Hold = "taking up" | "putting down" | "one" | "two";
    const run = (firstPerson: boolean, midSwing: boolean, perSec: number, hold: Hold) => {
      const f = fighter({ rightHand: "sword", leftHand: null, active: "rightHand" }, firstPerson);
      const swing = swingAt("light", "lr", 0), oneAt = (t: number) =>
        hold === "one" || (hold === "taking up" && t >= CHANGE_TIME) || (hold === "putting down" && t < CHANGE_TIME);
      let most = 0, last: Vector3[] | null = null;
      const underM = { before: 0, after: 0 };
      for (let i = 0; i <= END_TIME * perSec; i++) {
        const t = i / perSec, clock = (t - CHANGE_TIME) / FIXED_DT + swing.liveAt / 2;
        f.wielder.hands = { ...f.wielder.hands, leftHand: oneAt(t) ? "skillbook" : null };
        swing.step = Math.floor(clock) + 1;
        const swinging = midSwing && clock >= 0 && swing.step <= swing.endAt;
        f.frame(1 / perSec, swinging ? "attack" : "none", "lr", swinging ? swing : null, clock % 1);
        const now = [grips(f.p).main, grips(f.p).off,
          ...(["forearm.R", "forearm.L"] as const).map((j) => f.p.model!.joints[j].getAbsolutePosition().clone())];
        if (last && t > SETTLED_TIME) most = Math.max(most, ...now.map((v, k) => Vector3.Distance(v, last![k]!)));
        last = now;
        if (t < CHANGE_TIME) underM.before = grips(f.p).underM;
        underM.after = grips(f.p).underM;
      }
      dropPerson(f.p);
      return { most, underM };
    };
    for (const firstPerson of [false, true]) {
      for (const midSwing of [false, true]) {
        // Mid-swing the arms move fast anyway: no faster than the same swing held either way.
        const swingM = midSwing
          ? Math.max(run(firstPerson, true, 240, "one").most, run(firstPerson, true, 240, "two").most) : 0;
        for (const hold of ["taking up", "putting down"] as const) {
          const what = `${firstPerson ? "first" : "third"} person${midSwing ? ", mid-swing" : ""}, ${hold}`;
          const at60 = run(firstPerson, midSwing, 60, hold), at240 = run(firstPerson, midSwing, 240, hold);
          assert.ok(midSwing ? at240.most <= swingM : at240.most < at60.most / 2.5,
            `${what}: ${at60.most} m a frame at 60 fps, ${at240.most} at 240${midSwing ? ` (the swing: ${swingM})` : ""}`);
          const { before, after } = at240.underM, [gripped, free] = hold === "taking up" ? [before, after] : [after, before];
          assert.ok(gripped < ON_GRIP_M && free > 2 * OFF_GRIP_M, `${what}: ${gripped} m off the grip, then ${free}`);
        }
      }
    }
  });
});
