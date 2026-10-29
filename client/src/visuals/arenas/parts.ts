import {
  Color3, MeshBuilder, StandardMaterial, TransformNode, type Material, type Mesh, type Scene,
} from "@babylonjs/core";
import type { ArenaScene } from "../battle/scene.js";
import { speckleTexture, type SpeckleOptions } from "../textures.js";

const GROUND_SIZE_M = 120;

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
  spots: { x: number; z: number; scale: number; yaw: number }[], castShadows = true,
): void {
  for (const [tpl] of parts) {
    tpl.isVisible = false;
    tpl.parent = root;
    if (castShadows) ctx.sunShadows.addShadowCaster(tpl);
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

/** Nothing in an arena moves, so every mesh is frozen. */
export function settle(ctx: ArenaScene, root: TransformNode, casters: Mesh[] = []): TransformNode {
  for (const m of casters) {
    m.receiveShadows = true;
    ctx.sunShadows.addShadowCaster(m);
  }
  for (const m of root.getChildMeshes()) m.freezeWorldMatrix();
  return root;
}
