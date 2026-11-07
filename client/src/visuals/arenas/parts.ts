import {
  Color3, Material, Matrix, Mesh, MeshBuilder, Quaternion, StandardMaterial, Texture, TransformNode, Vector3, type Scene,
} from "@babylonjs/core";
import type { ArenaScene } from "../battle/scene.js";
import type { Pen } from "../overworld/props.js";
import { pixelCanvas } from "../sprites.js";
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

const SCALE = new Vector3(), AT = new Vector3(), TURN = new Quaternion(), PLACED = new Matrix();

/** `y`: each template's height at scale 1. */
export function scatter(
  ctx: ArenaScene, root: TransformNode, parts: [Mesh, number][],
  spots: Spot[], castShadows = true,
): void {
  for (const [tpl, y] of parts) {
    tpl.parent = root;
    // Thin instances' buffers live on the geometry, which a clone shares.
    tpl.makeGeometryUnique();
    const matrices = new Float32Array(16 * spots.length);
    spots.forEach(({ x, z, scale, yaw }, i) => {
      Quaternion.RotationYawPitchRollToRef(yaw, 0, 0, TURN);
      Matrix.ComposeToRef(SCALE.setAll(scale), TURN, AT.set(x, y * scale, z), PLACED).copyToArray(matrices, 16 * i);
    });
    tpl.thinInstanceSetBuffer("matrix", matrices, 16, true);
    tpl.thinInstanceRefreshBoundingInfo();
    tpl.isVisible = spots.length > 0;
    if (castShadows) ctx.sky.castShadows(tpl);
  }
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

export interface FarSprite { widthPx: number; heightPx: number; heightM: number; draw(pen: Pen): void }

export function litRound(pen: Pen, cx: number, y: number, half: number, rim = false): void {
  const w = Math.max(1, Math.round(2 * half)), from = Math.round(cx - half);
  if (rim) return pen.rect(from, y, w, 1, "#808080");
  pen.rect(from, y, w, 1, "#ffffff");
  pen.rect(from + Math.round(w / 3), y, w - Math.round(w / 3), 1, "#cccccc");
  pen.rect(from + Math.round(2 * w / 3), y, w - Math.round(2 * w / 3), 1, "#999999");
}

export function hazedRings(
  ctx: ArenaScene, root: TransformNode, own: <M extends Material>(m: M) => M, name: string, sprite: FarSprite,
  look: { color: Color3; sky: Color3 }, spots: { rand: () => number; count: number; near: number; far: number },
): Mesh[] {
  const art = pixelCanvas(ctx.scene, name, sprite.widthPx, sprite.heightPx, (pen) => sprite.draw(pen));
  // Smooth: the post's blocks make the pixels, and the sprite's own would step its edges twice.
  art.updateSamplingMode(Texture.BILINEAR_SAMPLINGMODE);
  const widthM = sprite.heightM * sprite.widthPx / sprite.heightPx, band = (spots.far - spots.near) / HAZE_SHARES.length;
  return HAZE_SHARES.map((share, i) => {
    const card = MeshBuilder.CreatePlane(`${name}-${i}`, { width: widthM, height: sprite.heightM }, ctx.scene);
    card.bakeTransformIntoVertices(Matrix.Translation(0, sprite.heightM / 2, 0));
    const m = own(new StandardMaterial(`${name}-${i}`, ctx.scene));
    const { diffuse, emissive } = hazed(look.color, look.sky, share);
    m.diffuseColor = diffuse;
    m.emissiveColor = emissive;
    m.diffuseTexture = m.emissiveTexture = art;
    m.specularColor = Color3.Black();
    m.useAlphaFromDiffuseTexture = true;
    m.transparencyMode = Material.MATERIAL_ALPHATEST;
    card.material = m;
    const near = spots.near + band * i, grow = 1 + 0.25 * i;
    faceCamera(ctx, root, card,
      ringSpots(spots.rand, Math.round(spots.count / HAZE_SHARES.length), near, near + band, 0.8 * grow, 1.4 * grow));
    return card;
  });
}

function faceCamera(ctx: ArenaScene, root: TransformNode, card: Mesh, spots: Spot[]): void {
  card.parent = root;
  card.thinInstanceSetBuffer("matrix", new Float32Array(16 * spots.length), 16, false);
  const placed = spots.map(() => new Matrix());
  const face = (eye: Vector3) => {
    spots.forEach(({ x, z, scale }, i) => {
      // The card's front faces -z, so its +z points away from the eye.
      Quaternion.RotationYawPitchRollToRef(Math.atan2(x - eye.x, z - eye.z), 0, 0, TURN);
      card.thinInstanceSetMatrixAt(i, Matrix.ComposeToRef(SCALE.setAll(scale), TURN, AT.set(x, 0, z), placed[i]!), false);
    });
    card.thinInstanceBufferUpdated("matrix");
  };
  face(Vector3.Zero());
  card.thinInstanceRefreshBoundingInfo();
  const turning = ctx.scene.onBeforeRenderObservable.add(() => {
    if (ctx.scene.activeCamera) face(ctx.scene.activeCamera.position);
  });
  root.onDisposeObservable.addOnce(() => ctx.scene.onBeforeRenderObservable.remove(turning));
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
