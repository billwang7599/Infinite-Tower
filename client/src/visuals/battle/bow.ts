import {
  Color3, Mesh, MeshBuilder, Quaternion, TransformNode, Vector3, type Scene, type StandardMaterial,
} from "@babylonjs/core";
import {
  drawnShare, FighterStats, Player, Projectile, rangedOf, smoothstep, weaponIn, WEAPONS, Wielder, type Entity,
  type ProjectileData, type World,
} from "@infinite-tower/shared";
import { colorMaterial } from "../materials.js";
import type { Visual } from "../visuals.js";
import type { BowLook, WeaponLook } from "./weapons.js";

const STAVE_RADIUS_M = 0.024;
const STAVE_SEGMENTS = 10;
const GRIP_M = 0.12;
const STRING_M = 0.012;
// Thicker than a real one, so it still shows a pixel wide on the arena's low-res render.
const SHAFT_M = 0.03;
export const ARROW_M = 0.7;
const SUNK_M = 0.12;
/** The fight looses an arrow from the shooter's centre-front: drawn, it leaves the bow and eases onto that path. */
export const LEAVE_BOW_TIME = 0.12;
const ARROW_COLORS = { shaft: "#c9a46a", head: "#9aa3ad", fletch: "#e8e4da" } as const;

export interface HeldBow { look: BowLook; strings: [Mesh, Mesh]; nocked: TransformNode; tips: [Vector3, Vector3] }

const up = Vector3.Up(), along = new Vector3(), mid = new Vector3();

/** Lays a mesh one unit long on its y axis from `a` to `b`. */
function span(mesh: Mesh, a: Vector3, b: Vector3): void {
  b.subtractToRef(a, along);
  mesh.position.copyFrom(a).addInPlace(b).scaleInPlace(0.5);
  mesh.scaling.y = along.length();
  mesh.rotationQuaternion ??= new Quaternion();
  Quaternion.FromUnitVectorsToRef(up, along.normalize(), mesh.rotationQuaternion);
}

/** An arrow along +z, its nock at 0. */
export function arrowMesh(scene: Scene, name: string, parent: TransformNode, materials: StandardMaterial[]): Mesh[] {
  const [shaft, head, fletch] = materials as [StandardMaterial, StandardMaterial, StandardMaterial];
  const box = (size: { width: number; height: number; depth: number }, z: number, material: StandardMaterial) => {
    const m = MeshBuilder.CreateBox(name, size, scene);
    m.parent = parent;
    m.material = material;
    m.isPickable = false;
    m.position.z = z;
    return m;
  };
  return [
    box({ width: SHAFT_M, height: SHAFT_M, depth: ARROW_M }, ARROW_M / 2, shaft),
    box({ width: SHAFT_M * 2, height: SHAFT_M * 2, depth: 0.07 }, ARROW_M, head),
    box({ width: SHAFT_M * 3, height: 0.005, depth: 0.12 }, 0.08, fletch),
    box({ width: 0.005, height: SHAFT_M * 3, depth: 0.12 }, 0.08, fletch),
  ];
}

export const arrowMaterials = (scene: Scene): StandardMaterial[] =>
  (["shaft", "head", "fletch"] as const).map((part) => {
    const m = colorMaterial(scene, `arrow-${part}`, Color3.FromHexString(ARROW_COLORS[part]));
    m.emissiveColor = m.diffuseColor.scale(0.35);
    return m;
  });

/** Along the hand's +y, the grip at 0, the limbs curving back (-z) to a string `braceM` behind it. */
export function buildBow(
  scene: Scene, hand: TransformNode, look: WeaponLook & { bow: BowLook }, stave: StandardMaterial,
  grip: StandardMaterial,
): { meshes: Mesh[]; materials: StandardMaterial[]; held: HeldBow } {
  const half = look.blade.lengthM / 2, { braceM } = look.bow;
  const path = Array.from({ length: STAVE_SEGMENTS + 1 }, (_, i) => {
    const y = -half + (2 * half * i) / STAVE_SEGMENTS;
    return new Vector3(0, y, -braceM * (y / half) ** 2);
  });
  const limbs = MeshBuilder.CreateTube("bow-stave", { path, radius: STAVE_RADIUS_M, tessellation: 6 }, scene);
  limbs.material = stave;
  const wrap = MeshBuilder.CreateCylinder("bow-grip", { height: GRIP_M, diameter: STAVE_RADIUS_M * 2.6 }, scene);
  wrap.material = grip;
  const string = colorMaterial(scene, "bow-string", Color3.FromHexString(look.bow.string));
  string.emissiveColor = string.diffuseColor.scale(0.5);
  const strings = [0, 1].map(() => {
    const m = MeshBuilder.CreateBox("bow-string", { width: STRING_M, height: 1, depth: STRING_M }, scene);
    m.material = string;
    return m;
  }) as [Mesh, Mesh];
  const nocked = new TransformNode("bow-nocked", scene);
  nocked.parent = hand;
  const arrow = arrowMaterials(scene);
  const meshes = [limbs, wrap, ...strings, ...arrowMesh(scene, "bow-nocked-arrow", nocked, arrow)];
  for (const m of [limbs, wrap, ...strings]) {
    m.parent = hand;
    m.isPickable = false;
  }
  const held: HeldBow = { look: look.bow, strings, nocked, tips: [path[0]!, path.at(-1)!] };
  pullString(held, 0, false);
  return { meshes, materials: [string, ...arrow], held };
}

/** `pull`: 0 at rest, 1 fully drawn; `nocked`: an arrow on the string. */
export function pullString(bow: HeldBow, pull: number, nocked: boolean): void {
  mid.set(0, 0, -bow.look.braceM - bow.look.drawM * pull);
  span(bow.strings[0], bow.tips[0], mid);
  span(bow.strings[1], mid, bow.tips[1]);
  bow.nocked.setEnabled(nocked);
  bow.nocked.position.copyFrom(mid);
}

export function bowDrawOf(world: World, e: Entity): { drawn: number; nocked: boolean } | null {
  const player = world.get(e, Player), weapon = weaponIn(world.require(e, Wielder).hands), bow = rangedOf(weapon);
  if (!bow || !weapon) return null;
  if (player?.action !== "draw") return { drawn: 0, nocked: false };
  return { drawn: drawnShare(bow, weapon, world.require(e, FighterStats).strength, player.actionTime), nocked: true };
}

interface FlyingArrow { root: TransformNode; materials: StandardMaterial[]; fromBow: Vector3 }

const heading = new Vector3(), forward = new Vector3(0, 0, 1);

const flownTime = (o: ProjectileData): number => rangedOf(WEAPONS[o.weapon])!.projectile.lifeTime - o.left;

export const arrowVisual: Visual<FlyingArrow> = {
  spawn({ scene, sky, bows }, world, e) {
    const root = new TransformNode(`arrow-${e}`, scene), materials = arrowMaterials(scene);
    for (const m of arrowMesh(scene, `arrow-${e}`, root, materials)) sky.castShadows(m);
    root.rotationQuaternion = new Quaternion();
    const o = world.require(e, Projectile), flown = flownTime(o), fromBow = Vector3.Zero();
    const nock = bows.get(o.shooter)?.nocked;
    place(root, o);
    if (nock && !nock.isDisposed() && !o.stuck && flown < LEAVE_BOW_TIME) {
      // From where the fight loosed it, so drawing it again after a reload doesn't move it.
      nock.computeWorldMatrix(true).getTranslationToRef(fromBow).subtractInPlace(root.position)
        .addInPlaceFromFloats(o.vel.x * flown, o.vel.y * flown, o.vel.z * flown);
    }
    const drawn = { root, materials, fromBow };
    arrowVisual.frame(drawn, world, e, 0);
    return drawn;
  },
  frame({ root, fromBow }, world, e) {
    const o = world.require(e, Projectile);
    place(root, o);
    if (!o.stuck) fromBow.scaleAndAddToRef(1 - smoothstep(0, LEAVE_BOW_TIME, flownTime(o)), root.position);
  },
  dispose({ root, materials }) {
    root.dispose();
    for (const m of materials) m.dispose();
  },
};

/** `pos` is its point. */
function place(root: TransformNode, o: ProjectileData): void {
  heading.set(o.vel.x, o.vel.y, o.vel.z);
  if (heading.lengthSquared() > 1e-9) {
    Quaternion.FromUnitVectorsToRef(forward, heading.normalize(), root.rotationQuaternion!);
  } else forward.rotateByQuaternionToRef(root.rotationQuaternion!, heading);
  heading.scaleInPlace(o.stuck ? ARROW_M - SUNK_M : ARROW_M);
  root.position.set(o.pos.x, o.pos.y, o.pos.z).subtractInPlace(heading);
}
