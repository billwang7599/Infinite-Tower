import { Color3, Mesh, MeshBuilder, TransformNode, type StandardMaterial } from "@babylonjs/core";
import { PLAYER, type Entity, type Look, type Vec3 } from "@infinite-tower/shared";
import { VIEWS } from "../../../gfx/look/art.js";
import { BATTLE_BUILDS, BODY_TYPES } from "../../../gfx/look/body.js";
import { colorsOf } from "../../../gfx/look/look.js";
import { BASE } from "../../../gfx/look/pixels.js";
import { colorMaterial } from "../../materials.js";
import { buildArm, placeBetween, type Arm } from "../arm.js";
import { SPRITE_SIZE } from "../pose.js";
import type { ArenaScene } from "../scene.js";

const M_PER_PX = SPRITE_SIZE / VIEWS.battle.width;
/** The sprite's head: its middle's row (battle.ts' frontHead) and about how far it reaches round. */
const HEAD_ROW = 19.4;
const HEAD_RADIUS_PX = 8.5;
/** The tunic's hem, this many rows under the belt (outfit.ts). */
const HEM_ROWS = 5;
const DEPTH = 0.62;

const rowY = (row: number): number => (VIEWS.battle.height - row) * M_PER_PX;

const COLORS = ["skin", "hair", "iris", "cloth", "accent", "leather", "wool", "line", "linen"] as const;

/** The sprite's proportions in metres, feet at 0; widths are half-widths. */
export interface PersonBuild {
  colors: Record<(typeof COLORS)[number], string>;
  hair: Look["hair"];
  face: Look["face"];
  shoulderM: number;
  waistM: number;
  hipM: number;
  armM: number;
  neckM: number;
  headM: number;
  reachM: number;
  legY: number;
  waistY: number;
  shoulderY: number;
  headY: number;
}

export function personBuild(look: Look): PersonBuild {
  const b = BATTLE_BUILDS[look.body], stand = BODY_TYPES[look.body].battle.back.stand[0]!;
  const [shoulder] = stand.shoulders, [grip] = stand.sword, ramps = colorsOf(look);
  return {
    colors: Object.fromEntries(COLORS.map((c) => [c, ramps[c]![BASE]])) as PersonBuild["colors"],
    hair: look.hair, face: look.face,
    shoulderM: (stand.middle - shoulder[0]) * M_PER_PX, waistM: b.waist * M_PER_PX, hipM: b.hip * M_PER_PX,
    armM: b.arm * M_PER_PX, neckM: b.neck * M_PER_PX, headM: HEAD_RADIUS_PX * M_PER_PX,
    reachM: (grip[1] - shoulder[1]) * M_PER_PX,
    legY: rowY(stand.waistY + HEM_ROWS + 1), waistY: rowY(stand.waistY), shoulderY: rowY(shoulder[1]),
    headY: rowY(HEAD_ROW),
  };
}

const FACE_SCALE: Record<Look["face"], Vec3> = {
  soft: { x: 1, y: 0.95, z: 1 }, sharp: { x: 0.92, y: 1, z: 0.95 }, square: { x: 1.03, y: 0.92, z: 1 },
};

export interface Leg { hip: TransformNode; knee: TransformNode }

export interface PersonModel {
  root: TransformNode;
  model: TransformNode;
  hips: TransformNode;
  chest: TransformNode;
  head: TransformNode;
  legs: [Leg, Leg];
  /** Right, left. */
  arms: [Arm, Arm];
  materials: StandardMaterial[];
}

export function disposePerson(m: PersonModel): void {
  m.root.dispose();
  for (const material of m.materials) material.dispose();
}

export function buildPerson(ctx: ArenaScene, e: Entity, parent: TransformNode, b: PersonBuild): PersonModel {
  const { scene, sky } = ctx;
  const mat = Object.fromEntries(COLORS.map((c) =>
    [c, colorMaterial(scene, `person-${c}`, Color3.FromHexString(b.colors[c]))])) as
    Record<(typeof COLORS)[number], StandardMaterial>;
  const parts: Mesh[] = [];
  const part = (m: Mesh, under: TransformNode, material: StandardMaterial): Mesh => {
    m.parent = under;
    m.material = material;
    m.isPickable = false;
    parts.push(m);
    return m;
  };
  const node = (name: string, under: TransformNode, y: number, x = 0): TransformNode => {
    const n = new TransformNode(name, scene);
    n.parent = under;
    n.position.set(x, y, 0);
    return n;
  };
  const ball = (under: TransformNode, material: StandardMaterial, at: Vec3, size: Vec3, slice = 1): Mesh => {
    const m = part(MeshBuilder.CreateSphere("p-ball", { diameter: 1, segments: 6, slice }, scene), under, material);
    m.position.set(at.x, at.y, at.z);
    m.scaling.set(size.x, size.y, size.z);
    return m;
  };
  const tube = (under: TransformNode, material: StandardMaterial, from: Vec3, to: Vec3, dFrom: number, dTo: number,
    flat = 1): Mesh => {
    const height = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    const m = part(MeshBuilder.CreateCylinder("p-tube", { height, diameterBottom: dFrom, diameterTop: dTo,
      tessellation: 8 }, scene), under, material);
    placeBetween(m, from, to);
    m.scaling.z = flat;
    return m;
  };
  const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

  const root = new TransformNode(`person-${e}`, scene);
  root.parent = parent;
  root.position.y = -PLAYER.height / 2;
  const model = node("p-model", root, 0);
  const hips = node("p-hips", model, b.legY), chest = node("p-chest", model, b.waistY);

  const hemY = b.waistY - b.legY;
  tube(hips, mat.cloth, v(0, -0.02, 0), v(0, hemY, 0), b.hipM * 2.3, b.waistM * 2, DEPTH);
  tube(hips, mat.accent, v(0, -0.03, 0), v(0, 0.01, 0), b.hipM * 2.35, b.hipM * 2.3, DEPTH);
  tube(hips, mat.leather, v(0, hemY - 0.03, 0), v(0, hemY + 0.02, 0), b.waistM * 2.15, b.waistM * 2.15, DEPTH);
  const top = b.shoulderY - b.waistY;
  tube(chest, mat.cloth, v(0, 0, 0), v(0, top, 0), b.waistM * 2, b.shoulderM * 2, DEPTH);
  for (const s of [-1, 1]) ball(chest, mat.cloth, v(s * b.shoulderM * 0.85, top - b.armM * 0.3, 0),
    v(b.armM * 1.5, b.armM * 1.2, b.armM * 1.4));
  const neckTop = b.headY - b.waistY - b.headM * 0.7;
  tube(chest, mat.skin, v(0, top - 0.04, 0), v(0, neckTop, 0), b.neckM * 2.4, b.neckM * 2);
  tube(chest, mat.linen, v(0, top - 0.03, 0.02), v(0, top + 0.02, 0.02), b.neckM * 3, b.neckM * 2.6, DEPTH);

  const head = node("p-head", chest, b.headY - b.waistY), r = b.headM, face = FACE_SCALE[b.face];
  ball(head, mat.skin, v(0, 0, 0), v(2 * r * face.x, 2 * r * face.y, 2 * r * face.z));
  for (const s of [-1, 1]) {
    ball(head, mat.line, v(s * r * 0.36, -r * 0.12, r * 0.84), v(r * 0.3, r * 0.38, r * 0.14));
    ball(head, mat.iris, v(s * r * 0.36, -r * 0.16, r * 0.9), v(r * 0.2, r * 0.26, r * 0.1));
  }
  const cap = ball(head, mat.hair, v(0, r * 0.04, -r * 0.04), v(2.2 * r, 2.2 * r, 2.2 * r), 0.55);
  cap.rotation.x = -0.55;
  const fringe = ball(head, mat.hair, v(0, r * 0.55, r * 0.5), v(1.7 * r, 0.6 * r, 0.8 * r));
  fringe.rotation.x = 0.4;
  if (b.hair === "bob") ball(head, mat.hair, v(0, -r * 0.35, -r * 0.2), v(2.25 * r, 1.5 * r, 1.9 * r));
  if (b.hair === "long") {
    ball(head, mat.hair, v(0, -r * 0.3, -r * 0.25), v(2.2 * r, 1.4 * r, 1.8 * r));
    tube(head, mat.hair, v(0, -r * 0.2, -r * 0.75), v(0, -r * 1.9, -r * 0.85), r * 1.3, r * 0.9, 0.3);
  }
  if (b.hair === "ponytail") {
    ball(head, mat.accent, v(0, r * 0.1, -r * 1.02), v(r * 0.35, r * 0.35, r * 0.3));
    tube(head, mat.hair, v(0, r * 0.1, -r * 1.05), v(0, -r * 1.6, -r * 1.35), r * 0.55, r * 0.15);
  }

  const leg = (s: number): Leg => {
    const hip = node("p-hip", hips, 0, s * b.hipM * 0.5), half = b.legY / 2, d = b.hipM * 0.85;
    tube(hip, mat.wool, v(0, 0.02, 0), v(0, -half, 0), d, d * 0.9);
    const knee = node("p-knee", hip, -half);
    tube(knee, mat.wool, v(0, 0, 0), v(0, -half * 0.4, 0), d * 0.9, d * 0.85);
    tube(knee, mat.leather, v(0, -half * 0.4, 0), v(0, -half, 0), d * 1.05, d);
    const foot = part(MeshBuilder.CreateBox("p-foot", { width: d, height: d * 0.5, depth: d * 1.7 }, scene), knee,
      mat.leather);
    foot.position.set(0, -half + d * 0.2, d * 0.35);
    return { hip, knee };
  };

  const arm = (side: 1 | -1): Arm => buildArm(scene, part, model, chest, {
    side, shoulder: { x: side * b.shoulderM * 0.92, y: top - b.armM * 0.35, z: 0 }, reachM: b.reachM,
    thicknessM: b.armM, upper: mat.cloth, fore: mat.cloth, fist: mat.skin,
  });

  const built: PersonModel = {
    root, model, hips, chest, head, legs: [leg(-1), leg(1)], arms: [arm(1), arm(-1)], materials: Object.values(mat),
  };
  for (const p of parts) sky.castShadows(p);
  return built;
}
