import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { NullEngine, Quaternion, Scene, TransformNode, Vector3, type AbstractMesh } from "@babylonjs/core";
import { DEFAULT_LOOK } from "@infinite-tower/shared";
import { reachWith } from "../../../../src/visuals/battle/person/animation.js";
import { buildPerson, personBuild } from "../../../../src/visuals/battle/person/model.js";
import type { Sky } from "../../../../src/visuals/sky/sky.js";

describe("the 3D person's arms", () => {
  test("bend so the hand lands on the pose's target and holds the blade its way, however the body is turned", () => {
    const scene = new Scene(new NullEngine());
    const sky = { castShadows: (_m: AbstractMesh) => {} } as unknown as Sky;
    const { joints, holder } = buildPerson({ scene, sky }, 1, new TransformNode("player", scene), personBuild(DEFAULT_LOOK));
    holder.rotation.y = 0.7;
    joints.root.rotation.set(0.3, 0, -0.2);
    joints.spine.rotation.y = -0.4;
    joints.chest.rotation.x = 0.2;
    const target = new Vector3(0.25, 0.9, 0.35), blade = new Vector3(0.3, 0.8, 0.5).normalize();
    const holding = new Quaternion();
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), blade, holding);
    reachWith(joints, "R", target, holding, { x: 0.5, y: -0.8, z: -0.45 });
    const root = joints.root.getWorldMatrix(), hand = joints["hand.R"];
    const want = Vector3.TransformCoordinates(target, root), got = hand.getAbsolutePosition();
    assert.ok(Vector3.Distance(want, got) < 1e-4, `${want} vs ${got}`);
    const along = Vector3.Up().applyRotationQuaternion(hand.absoluteRotationQuaternion);
    const wantAlong = Vector3.TransformNormal(blade, root).normalize();
    assert.ok(Vector3.Dot(along, wantAlong) > 0.9999, `${along} vs ${wantAlong}`);
    scene.dispose();
  });
});
