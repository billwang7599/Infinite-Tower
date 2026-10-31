import { Mesh, MeshBuilder, TransformNode, Vector3, type Material, type Scene } from "@babylonjs/core";
import type { Vec2, Vec3 } from "@infinite-tower/shared";
import type { TrailPose } from "./weapons.js";

const WIDTH_M = 2.2;

export interface Slash { root: TransformNode; mesh: Mesh }

// A cut across the swinger's view, a metre ahead: a shallow arc from x = 0 to WIDTH_M, pointed at both ends, turned
// to the swing's line and grown from its start. Seen from in front, it's the same cut mirrored.
export function buildSlash(scene: Scene, name: string, material: Material): Slash {
  const inner: Vector3[] = [], outer: Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24, x = u * WIDTH_M, bulge = Math.sin(u * Math.PI);
    const y = bulge * 0.22, thick = 0.04 + 0.2 * bulge;
    inner.push(new Vector3(x, y - thick / 2, 0));
    outer.push(new Vector3(x, y + thick / 2, 0));
  }
  const root = new TransformNode(`trail-${name}`, scene);
  const mesh = MeshBuilder.CreateRibbon(
    `slash-${name}`, { pathArray: [inner, outer], sideOrientation: Mesh.DOUBLESIDE }, scene,
  );
  mesh.parent = root;
  mesh.material = material;
  mesh.isPickable = false;
  mesh.renderingGroupId = 1;
  root.setEnabled(false);
  return { root, mesh };
}

export function placeSlash(slash: Slash, pose: TrailPose | null, chest: Vec3, dir: Vec2): void {
  slash.root.setEnabled(pose !== null);
  if (!pose) return;
  slash.root.position.set(chest.x + dir.x, chest.y, chest.z + dir.z);
  slash.root.rotation.set(0, Math.atan2(dir.x, dir.z), pose.rollRad);
  slash.mesh.position.x = pose.from * WIDTH_M / 2;
  slash.mesh.scaling.x = -pose.from * pose.reach;
  slash.mesh.visibility = pose.visibility;
}
