import { Color3, MeshBuilder, type Mesh, type Scene, type StandardMaterial } from "@babylonjs/core";
import { clamp, damp, type Vec3 } from "@infinite-tower/shared";
import { HIT_FLASH_TIME } from "@infinite-tower/shared/fight";
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

const PACE_EASE_RATE = 8;
const LEG_HOLD_RATE = 12;
const LEG_AIM_RATE = 18;

/** The speed (m/s) a body's walk is drawn at, eased after its own, so legs never freeze mid-step or start at a run. */
export const easePace = (pace: number, speed: number, dt: number): number => damp(pace, speed, PACE_EASE_RATE, dt);

/** A leg's held angle, as last eased toward, and how much of the leg it has from the walk (0..1). */
export interface LegHold { angle: number; share: number }
export const newLegHold = (): LegHold => ({ angle: 0, share: 0 });

export function holdLeg(h: LegHold, held: number | null | undefined, walk: number, dt: number): number {
  const holding = held !== null && held !== undefined;
  if (holding && h.share < 1e-3) h.angle = walk;
  if (holding) h.angle = damp(h.angle, held, LEG_AIM_RATE, dt);
  h.share = damp(h.share, holding ? 1 : 0, LEG_HOLD_RATE, dt);
  if (!holding && h.share < 1e-3) h.share = 0;
  return walk + (h.angle - walk) * h.share;
}

export const HIT_FLASH_COLOR = new Color3(0.9, 0.9, 0.9);

/** `flash`: seconds of the fight's hit flash left. */
export const flashShare = (flash: number): number => clamp(flash / HIT_FLASH_TIME, 0, 1);

export function flashOver(color: Color3, flash: number): void {
  Color3.LerpToRef(color, HIT_FLASH_COLOR, flashShare(flash), color);
}

export function flashMaterials(materials: readonly StandardMaterial[], base: readonly Color3[], flash: number): void {
  const share = flashShare(flash);
  for (let i = 0; i < materials.length; i++) {
    Color3.LerpToRef(base[i]!, HIT_FLASH_COLOR, share, materials[i]!.emissiveColor);
  }
}
