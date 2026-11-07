import {
  Color3, Constants, RawTexture, Texture, TransformNode, type Mesh, type Scene, type StandardMaterial,
} from "@babylonjs/core";
import { PLAYER, type Entity, type Look } from "@infinite-tower/shared";
import type { Picture } from "../../../gfx/look/art.js";
import { BATTLE_BUILDS } from "../../../gfx/look/body.js";
import { colorsOf } from "../../../gfx/look/look.js";
import type { Ramp } from "../../../gfx/look/palette.js";
import { BASE } from "../../../gfx/look/pixels.js";
import { colorMaterial } from "../../materials.js";
import type { ArenaScene } from "../scene.js";
import { buildHead, faceTexels, HEAD, hairTexels } from "./head.js";
import { SHAPES, STARTER_WEAR, type BodyPart, type PersonWear, type RampName, type Shape } from "./body.js";
import { loft, sectionAt, type Section } from "./loft.js";
import { buildSkeleton, M_PER_PX, restInModel, type JointName, type Joints } from "./skeleton.js";

/** Light every part gets even facing away from the sun, × its colour, so dark looks don't turn to silhouettes. */
export const FILL_LIGHT = 0.42;
/** Lit full on, a part is its base tone × this; less than 1 so light hair and cloth keep their shape. */
const DIFFUSE_SHARE = 0.78;
/** linkEmissiveWithDiffuse multiplies it by the diffuse colour, already × DIFFUSE_SHARE. */
export const FILL_EMISSIVE = Color3.White().scale(FILL_LIGHT / DIFFUSE_SHARE);

const COLORS = ["skin", "hair", "iris", "cloth", "accent", "leather", "wool", "line", "linen"] as const;

export interface PersonBuild {
  look: Look;
  colors: Record<(typeof COLORS)[number], string>;
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
  const b = BATTLE_BUILDS[look.body], ramps = colorsOf(look), at = (j: JointName) => restInModel(j, look.body);
  const hand = at("hand.R"), shoulder = at("upper_arm.R");
  return {
    look, colors: Object.fromEntries(COLORS.map((c) => [c, ramps[c]![BASE]])) as PersonBuild["colors"],
    shoulderM: shoulder.x, waistM: b.waist * M_PER_PX, hipM: b.hip * M_PER_PX, armM: b.arm * M_PER_PX,
    neckM: b.neck * M_PER_PX, headM: HEAD.y * M_PER_PX, reachM: shoulder.y - hand.y,
    legY: at("hips").y, waistY: at("spine").y, shoulderY: shoulder.y, headY: at("head").y + HEAD.middlePx * M_PER_PX,
  };
}

export type MaterialKey = RampName | "face" | "hair";

export interface Kit {
  scene: Scene;
  part: (mesh: Mesh, joint: TransformNode, material: StandardMaterial) => Mesh;
  mat: (key: MaterialKey) => StandardMaterial;
}

export interface PersonModel {
  /** Holds the skeleton half the player's height down, turned to face where they do. */
  holder: TransformNode;
  joints: Joints;
  materials: StandardMaterial[];
}

export function disposePerson(m: PersonModel): void {
  m.holder.dispose();
  for (const material of m.materials) material.dispose(false, true);
}

function pictureTexture(scene: Scene, name: string, pic: Picture, wrap: boolean): RawTexture {
  const tex = RawTexture.CreateRGBATexture(new Uint8Array(pic.rgba.buffer), pic.width, pic.height, scene, false, false,
    Texture.NEAREST_SAMPLINGMODE, Constants.TEXTURETYPE_UNSIGNED_BYTE);
  tex.name = name;
  tex.wrapU = tex.wrapV = wrap ? Texture.WRAP_ADDRESSMODE : Texture.CLAMP_ADDRESSMODE;
  return tex;
}

function personMaterial(scene: Scene, name: string, color: Color3): StandardMaterial {
  const m = colorMaterial(scene, name, color.scale(DIFFUSE_SHARE));
  m.linkEmissiveWithDiffuse = true;
  m.emissiveColor = FILL_EMISSIVE.clone();
  return m;
}

export function buildPerson(
  { scene, sky }: Pick<ArenaScene, "scene" | "sky">, e: Entity, parent: TransformNode, b: PersonBuild,
  wear: Readonly<Record<string, PersonWear>> = STARTER_WEAR,
): PersonModel {
  const { look } = b, ramps = colorsOf(look), build = BATTLE_BUILDS[look.body];
  const materials = new Map<MaterialKey, StandardMaterial>(), meshes: Mesh[] = [];
  const mat = (key: MaterialKey): StandardMaterial => {
    let m = materials.get(key);
    if (m) return m;
    if (key === "face" || key === "hair") {
      m = personMaterial(scene, `person-${key}`, Color3.White());
      const pic = key === "face" ? faceTexels(look) : hairTexels(ramps.hair! as Ramp);
      m.diffuseTexture = pictureTexture(scene, `person-${key}`, pic, key === "hair");
      if (key === "hair") m.backFaceCulling = false;
    } else {
      m = personMaterial(scene, `person-${key}`, Color3.FromHexString(ramps[key]![BASE]));
    }
    materials.set(key, m);
    return m;
  };
  const part = (mesh: Mesh, joint: TransformNode, material: StandardMaterial): Mesh => {
    mesh.parent = joint;
    mesh.material = material;
    mesh.isPickable = false;
    meshes.push(mesh);
    return mesh;
  };
  const toMetres = (s: Section): Section => ({
    y: s.y * M_PER_PX, x: s.x * M_PER_PX, z: s.z * M_PER_PX, dz: (s.dz ?? 0) * M_PER_PX, dx: (s.dx ?? 0) * M_PER_PX,
  });

  const holder = new TransformNode(`person-${e}`, scene);
  holder.parent = parent;
  holder.position.y = -PLAYER.height / 2;
  const joints = buildSkeleton(scene, holder, look.body);

  const covered: Partial<Record<BodyPart, RampName>> = Object.assign({}, ...Object.values(wear).map((w) => w.covers));
  for (const [name, shape] of Object.entries(SHAPES) as [BodyPart, Shape][]) {
    const sections = shape.sections(build).map(toMetres);
    for (const j of shape.joints) {
      part(loft(scene, `person-${name}`, sections, shape.roundness), joints[j], mat(covered[name] ?? "skin"));
    }
  }
  for (const extra of Object.values(wear).flatMap((w) => w.extras ?? [])) {
    const shape = SHAPES[extra.on], { band } = extra;
    const sections = extra.sections ? extra.sections(build) : [band!.from, band!.to].map((y) => {
      const s = sectionAt(shape.sections(build), y);
      return { ...s, x: s.x + band!.grow, z: s.z + band!.grow };
    });
    for (const j of shape.joints) {
      part(loft(scene, `person-${extra.on}-trim`, sections.map(toMetres), shape.roundness), joints[j], mat(extra.ramp));
    }
  }
  buildHead({ scene, part, mat }, joints.head, look);

  for (const m of meshes) sky.castShadows(m);
  return { holder, joints, materials: [...materials.values()] };
}
