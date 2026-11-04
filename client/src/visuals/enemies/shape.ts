import { Color3, MeshBuilder, type Mesh, type Scene, type StandardMaterial } from "@babylonjs/core";
import type { Vec3 } from "@infinite-tower/shared";
import { placeBetween } from "../battle/arm.js";
import { loft } from "../battle/person/loft.js";
import { colorMaterial } from "../materials.js";

/** A cross-section across a body lying along z: half-width w, half-height h, its middle dy up and dx aside. */
export interface Rib { z: number; w: number; h: number; dy?: number; dx?: number }

/** Light every part keeps facing away from the sun, × its own colour, cooled as if from the sky. */
export const ENEMY_FILL = 0.22;
export const ENEMY_SHADE_TINT = new Color3(0.85, 0.95, 1.2);

export function enemyMaterial(scene: Scene, name: string, hex: string, specular = 0.05): StandardMaterial {
  const color = Color3.FromHexString(hex);
  const m = colorMaterial(scene, name, color, new Color3(specular, specular, specular));
  m.emissiveColor = color.multiply(ENEMY_SHADE_TINT).scale(ENEMY_FILL);
  return m;
}

/** Ribs back to front. */
export function lengthwise(scene: Scene, name: string, ribs: readonly Rib[], roundness?: number): Mesh {
  const mesh = loft(scene, name, ribs.map((r) => ({ y: r.z, x: r.w, z: r.h, dz: -(r.dy ?? 0), dx: r.dx ?? 0 })),
    roundness);
  mesh.rotation.x = Math.PI / 2;
  mesh.bakeCurrentTransformIntoVertices();
  return mesh;
}

export function limb(scene: Scene, name: string, from: Vec3, to: Vec3, dFrom: number, dTo: number, sides = 7): Mesh {
  const height = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  const m = MeshBuilder.CreateCylinder(name, { height, diameterBottom: dFrom, diameterTop: dTo, tessellation: sides },
    scene);
  placeBetween(m, from, to);
  return m;
}

export const breathOf = (time: number, periodTime: number) => Math.sin((2 * Math.PI * time) / periodTime);

/** 0, but for a twitch `lengthTime` long once every `everyTime`. */
export function flickOf(time: number, everyTime: number, lengthTime = 0.25): number {
  const t = ((time % everyTime) + everyTime) % everyTime;
  return t < lengthTime ? Math.sin((Math.PI * t) / lengthTime) : 0;
}
