import { MeshBuilder, type Mesh, type StandardMaterial } from "@babylonjs/core";
import type { MapView } from "../scene.js";

/** A flat quad lying on the field, top of the sprite toward +z (up on screen). */
export function flatSprite(view: MapView, name: string, size: number, material: StandardMaterial): Mesh {
  const m = MeshBuilder.CreatePlane(name, { size }, view.scene);
  m.rotation.x = Math.PI / 2;
  m.material = material;
  return m;
}
