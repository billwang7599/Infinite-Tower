import {
  Color3, Mesh, MeshBuilder, Quaternion, TransformNode, Vector3, type Camera, type Scene, type StandardMaterial,
} from "@babylonjs/core";
import { flightAfter, Projectile, rangedOf, smoothstep, WEAPONS, type ProjectileData } from "@infinite-tower/shared";
import { colorMaterial } from "../materials.js";
import type { Visual } from "../visuals.js";
import { buildRibbon, updateRibbon, type Ribbon } from "./slash.js";
import type { BowLook, WeaponLook } from "./weapons.js";

const STAVE_RADIUS_M = 0.024;
const STAVE_SEGMENTS = 10;
const GRIP_M = 0.12;
const STRING_M = 0.012;
// Thicker than a real one, so it still shows a pixel wide on the arena's low-res render.
const SHAFT_M = 0.03;
export const ARROW_M = 0.7;
export const ARROW_REST = { x: -(STAVE_RADIUS_M + SHAFT_M / 2), y: GRIP_M / 2 } as const;
const FLEX_M = 0.08;
const SUNK_M = 0.12;
/** The fight looses an arrow from the shooter's centre-front: drawn, it leaves the bow and eases onto that path. */
export const LEAVE_BOW_TIME = 0.12;
const ARROW_COLORS = { shaft: "#c9a46a", head: "#9aa3ad", fletch: "#e8e4da" } as const;
export const TRAIL = { lengthS: 0.2, points: 9, widthM: 0.035, minWidthPx: 3, alpha: 0.9 };

export interface HeldBow {
  look: BowLook; halfM: number; limbs: Mesh; path: Vector3[]; strings: [Mesh, Mesh]; nocked: TransformNode;
  tips: [Vector3, Vector3]; flex: number;
}

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
  const halfM = look.blade.lengthM / 2, path = Array.from({ length: STAVE_SEGMENTS + 1 }, () => new Vector3());
  bend(path, halfM, look.bow.braceM, 0);
  const limbs = MeshBuilder.CreateTube("bow-stave", {
    path, radius: STAVE_RADIUS_M, tessellation: 6, updatable: true,
  }, scene);
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
  const held: HeldBow = {
    look: look.bow, halfM, limbs, path, strings, nocked, tips: [path[0]!, path.at(-1)!], flex: 0,
  };
  pullString(held, 0, false);
  return { meshes, materials: [string, ...arrow], held };
}

function bend(path: Vector3[], halfM: number, braceM: number, flexM: number): void {
  const longer = (depthM: number) => 1 + (2 / 3) * (depthM / halfM) ** 2, n = path.length - 1;
  const backM = braceM + flexM, tallM = (halfM * longer(braceM)) / longer(backM);
  path.forEach((p, i) => {
    const share = (2 * i) / n - 1;
    p.set(0, tallM * share, -backM * share * share);
  });
}

export function pullString(bow: HeldBow, pull: number, nocked: boolean): void {
  const flex = Math.max(0, pull);
  if (flex !== bow.flex) {
    bow.flex = flex;
    bend(bow.path, bow.halfM, bow.look.braceM, FLEX_M * flex);
    MeshBuilder.CreateTube("bow-stave", { path: bow.path, instance: bow.limbs });
  }
  mid.set(ARROW_REST.x, ARROW_REST.y, -bow.look.braceM - bow.look.drawM * pull);
  span(bow.strings[0], bow.tips[0], mid);
  span(bow.strings[1], mid, bow.tips[1]);
  bow.nocked.setEnabled(nocked);
  bow.nocked.position.copyFrom(mid);
}

interface FlyingArrow {
  root: TransformNode; materials: StandardMaterial[]; fromBow: Vector3; trail: Ribbon; camera: Camera;
}

const heading = new Vector3(), forward = new Vector3(0, 0, 1), pastHeading = new Vector3(), past = new Vector3();
const toEye = new Vector3(), side = new Vector3(), edge = new Vector3();

const flightOf = (o: ProjectileData) => rangedOf(WEAPONS[o.weapon])!.projectile;
const flownTime = (o: ProjectileData): number => flightOf(o).lifeTime - o.left;
const offBow = (flown: number): number => 1 - smoothstep(0, LEAVE_BOW_TIME, flown);

function nockAgo(o: ProjectileData, agoTime: number, way: Vector3, nock: Vector3): void {
  const { pos, vel } = flightAfter(flightOf(o), o.pos, o.vel, -agoTime);
  way.set(vel.x, vel.y, vel.z).normalize().scaleAndAddToRef(-ARROW_M, nock.set(pos.x, pos.y, pos.z));
}

export const arrowVisual: Visual<FlyingArrow> = {
  spawn({ scene, sky, bows, camera, materials: { arrowTrail } }, world, e) {
    const root = new TransformNode(`arrow-${e}`, scene), materials = arrowMaterials(scene);
    for (const m of arrowMesh(scene, `arrow-${e}`, root, materials)) sky.castShadows(m);
    root.rotationQuaternion = new Quaternion();
    const o = world.require(e, Projectile), flown = flownTime(o), fromBow = Vector3.Zero();
    const nock = bows.get(o.shooter)?.nocked;
    place(root, o);
    if (nock && !nock.isDisposed() && !o.stuck && flown < LEAVE_BOW_TIME) {
      // From where the fight loosed it, so drawing it again after a reload doesn't move it.
      nockAgo(o, flown, pastHeading, past);
      nock.computeWorldMatrix(true).getTranslationToRef(fromBow).subtractInPlace(past);
    }
    const trail = buildRibbon(scene, `arrow-trail-${e}`, TRAIL.points, arrowTrail);
    const drawn = { root, materials, fromBow, trail, camera };
    arrowVisual.frame(drawn, world, e, 0);
    return drawn;
  },
  frame({ root, fromBow, trail, camera }, world, e) {
    const o = world.require(e, Projectile);
    place(root, o);
    if (!o.stuck) fromBow.scaleAndAddToRef(offBow(flownTime(o)), root.position);
    drawTrail(trail, o, fromBow, camera);
  },
  dispose({ root, materials, trail }) {
    root.dispose();
    trail.mesh.dispose();
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

function drawTrail(trail: Ribbon, o: ProjectileData, fromBow: Vector3, camera: Camera): void {
  const flown = o.stuck ? 0 : flownTime(o), spanS = Math.min(TRAIL.lengthS, flown);
  trail.mesh.setEnabled(spanS > 0);
  if (spanS <= 0) return;
  const { positions, colors } = trail;
  const metresPerPx = (2 * Math.tan(camera.fov / 2)) / camera.getEngine().getRenderHeight();
  for (let i = 0; i < TRAIL.points; i++) {
    const ago = (spanS * i) / (TRAIL.points - 1);
    nockAgo(o, ago, pastHeading, past);
    fromBow.scaleAndAddToRef(offBow(flown - ago), past);
    past.subtractToRef(camera.position, toEye);
    const widthM = Math.max(TRAIL.widthM, TRAIL.minWidthPx * metresPerPx * toEye.length());
    Vector3.CrossToRef(pastHeading, toEye, side).normalize().scaleInPlace(widthM / 2);
    past.subtractToRef(side, edge).toArray(positions, i * 6);
    past.addToRef(side, edge).toArray(positions, i * 6 + 3);
    colors[i * 8 + 3] = colors[i * 8 + 7] =
      TRAIL.alpha * (1 - ago / TRAIL.lengthS) * smoothstep(0, LEAVE_BOW_TIME, flown - ago);
  }
  updateRibbon(trail);
}
