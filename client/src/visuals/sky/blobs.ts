import { MeshBuilder, type Material, type Mesh, type Scene } from "@babylonjs/core";
import type { Vec3 } from "@infinite-tower/shared";

const BLOB = { contactAlpha: 0.45, alphaPerShare: 1.6, minAlpha: 0.05, stretchPerCot: 0.5, maxStretch: 2.6 };

export interface BlobShadow { yawRad: number; stretch: number; shift: { x: number; z: number }; alpha: number }

/** Brightness is a light's intensity × its colour's luminance. */
export interface Lighting {
  skyBrightness: number;
  direct: { toLight: Vec3; brightness: number };
  lamps: { at: Vec3; brightness: number; rangeM: number }[];
}

export interface Blobs {
  place(ground: Vec3 | null, centreM: number, scale?: number): void;
  dispose(): void;
}

const CONTACT: BlobShadow = { yawRad: 0, stretch: 1, shift: { x: 0, z: 0 }, alpha: BLOB.contactAlpha };

function castAway(toLight: Vec3, alpha: number): BlobShadow {
  const flat = Math.hypot(toLight.x, toLight.z);
  if (flat < 1e-6) return { ...CONTACT, alpha };
  const away = { x: -toLight.x / flat, z: -toLight.z / flat };
  const stretch = 1 + Math.min(BLOB.maxStretch - 1, (flat / Math.max(toLight.y, 1e-3)) * BLOB.stretchPerCot);
  const half = (stretch - 1) / 2;
  return { yawRad: Math.atan2(-away.z, away.x), stretch, shift: { x: away.x * half, z: away.z * half }, alpha };
}

export function blobShadowsAt(ground: Vec3, centreM: number, { skyBrightness, direct, lamps }: Lighting): BlobShadow[] {
  const casts = [{ toLight: direct.toLight, lit: direct.brightness * Math.max(0, direct.toLight.y) }];
  for (const { at, brightness, rangeM } of lamps) {
    const up = at.y - ground.y, d = Math.max(Math.hypot(at.x - ground.x, up, at.z - ground.z), 1e-3);
    const lit = brightness * Math.max(0, 1 - d / rangeM) * Math.max(0, up / d);
    if (lit > 0) casts.push({ toLight: { x: at.x - ground.x, y: up - centreM, z: at.z - ground.z }, lit });
  }
  const total = casts.reduce((sum, c) => sum + c.lit, skyBrightness);
  const shadows = [CONTACT];
  for (const { toLight, lit } of casts) {
    const alpha = total > 0 ? Math.min(1, (lit / total) * BLOB.alphaPerShare) : 0;
    if (alpha >= BLOB.minAlpha) shadows.push(castAway(toLight, alpha));
  }
  return shadows;
}

export function createBlobs(
  scene: Scene, lighting: Lighting, material: Material, lengthM: number, widthM: number,
): Blobs {
  const meshes: Mesh[] = [];
  return {
    place(ground, centreM, scale = 1) {
      const casts = ground ? blobShadowsAt(ground, centreM, lighting) : [];
      while (meshes.length < casts.length) {
        const m = MeshBuilder.CreateGround("blob-shadow", { width: lengthM, height: widthM }, scene);
        m.material = material;
        m.isPickable = false;
        meshes.push(m);
      }
      meshes.forEach((m, i) => {
        const cast = casts[i];
        m.setEnabled(cast !== undefined);
        if (!cast || !ground) return;
        const shiftM = lengthM * scale;
        m.position.set(ground.x + cast.shift.x * shiftM, ground.y + 0.02, ground.z + cast.shift.z * shiftM);
        m.rotation.y = cast.yawRad;
        m.scaling.set(scale * cast.stretch, 1, scale);
        m.visibility = cast.alpha;
      });
    },
    dispose() {
      for (const m of meshes) m.dispose();
    },
  };
}
