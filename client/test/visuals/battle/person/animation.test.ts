import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NullEngine, Quaternion, Scene, TransformNode, Vector3, type AbstractMesh } from "@babylonjs/core";
import {
  DEFAULT_LOOK, FIXED_DT, LOOK_OPTIONS, PLAYER, WAYS, type Look, type PlayerData, type SwingData, type WeaponId,
} from "@infinite-tower/shared";
import { BATTLE_BUILDS } from "../../../../src/gfx/look/body.js";
import { BLADE_FROM_M } from "../../../../src/visuals/battle/blade.js";
import { handSide, reachArms, reachWith } from "../../../../src/visuals/battle/person/animation.js";
import { SHAPES } from "../../../../src/visuals/battle/person/body.js";
import { ROUNDNESS } from "../../../../src/visuals/battle/person/loft.js";
import {
  buildPerson, personBuild, toMetres, type PersonBuild,
} from "../../../../src/visuals/battle/person/model.js";
import { personPose, POSED_JOINTS } from "../../../../src/visuals/battle/person/pose.js";
import { M_PER_PX, type Joints } from "../../../../src/visuals/battle/person/skeleton.js";
import { MOTIONS, WEAPON_LOOKS } from "../../../../src/visuals/battle/weapons.js";
import type { Sky } from "../../../../src/visuals/sky/sky.js";
import { alongSegment, depthIn, loftSurface, type Loft } from "../../../fixtures/clearance.js";
import { playerDoing } from "../../../fixtures/players.js";
import { swingSteps } from "../../../fixtures/swings.js";

const sky = { castShadows: (_m: AbstractMesh) => {} } as unknown as Sky;

describe("the hand a 3D person holds its weapon in", () => {
  test("a sword is in the hand it's equipped in; a bow always in the left, on the shoulder camera's side", () => {
    assert.equal(handSide({ rightHand: "sword", leftHand: null }, "sword"), 1);
    assert.equal(handSide({ rightHand: null, leftHand: "sword" }, "sword"), -1);
    assert.equal(handSide({ rightHand: "training-bow", leftHand: null }, "training-bow"), -1);
    assert.equal(handSide({ rightHand: "skillbook", leftHand: "training-bow" }, "training-bow"), -1);
    assert.equal(handSide({ rightHand: null, leftHand: null }, null), 1);
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

interface Case { what: string; player: PlayerData; swing?: SwingData; extra?: Partial<Moment>; weapon: WeaponId | null }
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
  for (const [weapon, attacks] of [["sword", ["light", "heavy"]], ["greatsword", ["heavy"]]] as const) {
    for (const attack of attacks) {
      for (const way of WAYS) {
        for (const swing of swingSteps(attack, way).filter((s) => s.step % swingEvery === 0)) {
          all.push({ what: `${weapon} ${attack} ${way} step ${swing.step}`, player: playerDoing("attack", 0), swing,
            weapon });
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
  const turn = new Quaternion();
  Quaternion.FromUnitVectorsToRef(Vector3.Up(), new Vector3(p.blade.x, p.blade.y, p.blade.z), turn);
  const hand = new Vector3(p.hand.x, p.hand.y, p.hand.z);
  reachArms(joints, build.look.body, side, hand, turn, p.offHand, alive ? held : null);
  for (const j of Object.values(joints)) j.computeWorldMatrix(true);
}

function deepestIn(body: Look["body"], swingEvery: number): { depthM: number; where: string } {
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
    for (const c of cases(swingEvery)) {
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
        if (!swordArm || !held || held.bow) continue;
        const grip = joints[`grip.${s}`].getWorldMatrix();
        const edge = (y: number) => Vector3.TransformCoordinates(new Vector3(0, y, 0), grip);
        for (const at of alongSegment(edge(BLADE_FROM_M), edge(BLADE_FROM_M + held.blade.lengthM), 20)) {
          const depthM = depthIn(torso, at, held.blade.widthM / 2);
          if (depthM > worst.depthM) worst = { depthM, where: `the blade, ${c.what}` };
        }
      }
    }
  }
  scene.dispose();
  return worst;
}

describe("the 3D person's arms go round its body", () => {
  test("in every pose no upper arm, forearm, hand or held blade passes into the torso, left- or right-handed", () => {
    for (const body of LOOK_OPTIONS.body) {
      const { depthM, where } = deepestIn(body, body === "medium" ? 1 : 3);
      assert.ok(depthM <= TOLERANCE_M, `${body}: ${(depthM * 100).toFixed(1)} cm in, ${where}`);
    }
  });
});
