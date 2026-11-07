import {
  Color3, Mesh, MeshBuilder, StandardMaterial, TransformNode, type Material, type Scene,
} from "@babylonjs/core";
import type { ArenaScene } from "../battle/scene.js";
import { colorMaterial } from "../materials.js";
import { blotTexture, speckleTexture, type SpeckleOptions } from "../textures.js";

const GROUND_SIZE_M = 120;
/** A patch's texture repeats, so its specks come out the floor's size. */
const PATCH_TILES = 0.4;

/** Disposing the root also disposes the materials passed to `own`. */
export function lookRoot(scene: Scene, name: string): { root: TransformNode; own<M extends Material>(m: M): M } {
  const root = new TransformNode(name, scene);
  const owned: Material[] = [];
  root.onDisposeObservable.addOnce(() => { for (const m of owned) m.dispose(false, true); });
  return { root, own: (m) => { owned.push(m); return m; } };
}

export function speckled(scene: Scene, name: string, opts: SpeckleOptions, tiles: number): StandardMaterial {
  const tex = speckleTexture(scene, name, opts);
  tex.uScale = tex.vScale = tiles;
  const m = new StandardMaterial(name, scene);
  m.diffuseTexture = tex;
  m.specularColor = Color3.Black();
  return m;
}

export function floor(ctx: ArenaScene, root: TransformNode, ground: Material, disc: Material, radius: number): void {
  const plane = MeshBuilder.CreateGround("arena-ground", { width: GROUND_SIZE_M, height: GROUND_SIZE_M }, ctx.scene);
  plane.material = ground;
  const inner = MeshBuilder.CreateDisc("arena-floor", { radius: radius + 1, tessellation: 64 }, ctx.scene);
  inner.rotation.x = Math.PI / 2;
  inner.position.y = 0.01;
  inner.material = disc;
  disc.zOffset = -1;
  for (const m of [plane, inner]) {
    m.receiveShadows = true;
    m.parent = root;
  }
}

/** `y`: each template's height at scale 1. */
export function scatter(
  ctx: ArenaScene, root: TransformNode, parts: [Mesh, number][],
  spots: Spot[], castShadows = true,
): void {
  for (const [tpl] of parts) {
    tpl.isVisible = false;
    tpl.parent = root;
    if (castShadows) ctx.sky.castShadows(tpl);
  }
  spots.forEach(({ x, z, scale, yaw }, i) => {
    for (const [tpl, y] of parts) {
      const inst = tpl.createInstance(`${tpl.name}-${i}`);
      inst.parent = root;
      inst.position.set(x, y * scale, z);
      inst.scaling.setAll(scale);
      inst.rotation.y = yaw;
    }
  });
}

export function ringSpots(
  rand: () => number, count: number, near: number, far: number, minScale: number, maxScale: number,
) {
  return Array.from({ length: count }, () => {
    const a = rand() * Math.PI * 2, r = near + rand() * (far - near);
    const scale = minScale + rand() * (maxScale - minScale);
    return { x: Math.sin(a) * r, z: Math.cos(a) * r, scale, yaw: rand() * Math.PI };
  });
}

type Spot = { x: number; z: number; scale: number; yaw: number };

export function patches(
  ctx: ArenaScene, root: TransformNode, own: <M extends Material>(m: M) => M, name: string,
  colors: Pick<SpeckleOptions, "base" | "specks">, spots: Spot[],
): void {
  const blot = MeshBuilder.CreateGround(name, { width: 2, height: 2 * 0.65 }, ctx.scene);
  const m = own(speckled(ctx.scene, name, { ...colors, count: 900, maxRadiusPx: 5, seed: name.length }, PATCH_TILES));
  m.opacityTexture = blotTexture(ctx.scene, `${name}-edge`, name.length);
  m.zOffset = -2;
  blot.material = m;
  blot.receiveShadows = true;
  scatter(ctx, root, [[blot, 0.012]], spots, false);
}

export const HAZE_SHARES = [0.2, 0.42, 0.62] as const;

export function hazed(color: Color3, sky: Color3, share: number): { diffuse: Color3; emissive: Color3 } {
  const c = Color3.Lerp(color, sky, share);
  return { diffuse: c.scale(1 - share), emissive: c.scale(share) };
}

export function hazedRings(
  ctx: ArenaScene, root: TransformNode, own: <M extends Material>(m: M) => M, tpl: Mesh, y: number,
  look: { color: Color3; sky: Color3 }, spots: { rand: () => number; count: number; near: number; far: number },
): void {
  const band = (spots.far - spots.near) / HAZE_SHARES.length;
  HAZE_SHARES.forEach((share, i) => {
    const layer = i === 0 ? tpl : tpl.clone(`${tpl.name}-${i}`);
    const { diffuse, emissive } = hazed(look.color, look.sky, share);
    const m = own(colorMaterial(ctx.scene, `${tpl.name}-${i}`, diffuse));
    m.emissiveColor = emissive;
    layer.material = m;
    const near = spots.near + band * i, grow = 1 + 0.25 * i;
    scatter(ctx, root, [[layer, y]],
      ringSpots(spots.rand, Math.round(spots.count / HAZE_SHARES.length), near, near + band, 0.8 * grow, 1.4 * grow),
      false);
  });
}

export function tuft(scene: Scene, name: string, heightM: number, blades = 5): Mesh {
  const parts = Array.from({ length: blades }, (_, i) => {
    const a = (i / blades) * Math.PI * 2, h = heightM * (0.7 + 0.3 * ((i * 7) % 3) / 2);
    const blade = MeshBuilder.CreateCylinder(name, { height: h, diameterTop: 0, diameterBottom: 0.07, tessellation: 3 },
      scene);
    blade.position.set(Math.sin(a) * 0.06, h / 2, Math.cos(a) * 0.06);
    blade.rotation.set(Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35);
    return blade;
  });
  const clump = Mesh.MergeMeshes(parts, true)!;
  clump.name = name;
  return clump;
}

export function boulder(scene: Scene, name: string): Mesh {
  const rock = MeshBuilder.CreatePolyhedron(name, { type: 2, size: 0.5 }, scene);
  rock.scaling.set(1.2, 0.65, 0.95);
  rock.bakeCurrentTransformIntoVertices();
  return rock;
}

/** Nothing in an arena moves, so every mesh is frozen. */
export function settle(ctx: ArenaScene, root: TransformNode, casters: Mesh[] = []): TransformNode {
  for (const m of casters) {
    m.receiveShadows = true;
    ctx.sky.castShadows(m);
  }
  for (const m of root.getChildMeshes()) m.freezeWorldMatrix();
  return root;
}
