import {
  Color3, Color4, DirectionalLight, HemisphericLight, Mesh, MeshBuilder, PointLight, ShadowGenerator,
  Scene, StandardMaterial, Vector3, type AbstractMesh, type Material,
} from "@babylonjs/core";
import { moonAt, sunAt, type Vec3 } from "@infinite-tower/shared";
import { createBlobs, type Blobs, type Lighting } from "./blobs.js";
import { dayFractionAt, daylightAt, directLightAt, MOONLIGHT } from "./daylight.js";

export interface SkyLook {
  sky: Color3;
  fogDensity: number;
  ambient: Color3;
  skyLight: { color: Color3; ground: Color3; intensity: number };
  sun: { color: Color3; intensity: number };
}

/** `flicker`: how far its brightness wavers, as a share. */
export interface MapLight { at: Vec3; color: Color3; intensity: number; rangeM: number; flicker: number }

export const MAX_MAP_LIGHTS = 4;
export const SHADOW_MAP_LIGHTS = 2;
/** A map light keeps its shadows until another is this much nearer the camera, so shaders don't swap back and forth. */
export const SHADOW_SWAP_MARGIN_M = 2;
const SPRITE_LIGHT = { sky: 1.3, direct: 0.7, map: 0.6 };
const SUN_DISC = { color: new Color3(3, 2.6, 2), radiusM: 5 };
const MOON_DISC = { color: new Color3(1.2, 1.3, 1.5), radiusM: 3.5 };
const DISC_DISTANCE_M = 400;
const BODY_DISTANCE_M = 40;
const POINT_SHADOW_MAP_PX = 512;
const FLICKER_RAD_PER_SEC = [7.3, 13.1] as const;

export function cardYawRad(toLight: Vec3): number {
  return Math.atan2(toLight.x, toLight.z);
}

export function nearestLights(spots: Vec3[], camera: Vec3, count: number, current: number[]): number[] {
  const biased = spots.map((s, i) =>
    Math.hypot(s.x - camera.x, s.y - camera.y, s.z - camera.z) - (current.includes(i) ? SHADOW_SWAP_MARGIN_M : 0));
  return spots.map((_, i) => i).sort((a, b) => biased[a]! - biased[b]!).slice(0, count).sort((a, b) => a - b);
}

interface Lamp { light: PointLight; shadows: ShadowGenerator }

export interface Sky {
  look(look: SkyLook, lights: MapLight[]): void;
  tint(look: SkyLook): void;
  /** `only`: cast by the sun or moon alone, or by that map light alone (a card turned to it). */
  castShadows(mesh: AbstractMesh, only?: "direct" | MapLight): void;
  clearShadows(): void;
  dropShadows(meshes: readonly AbstractMesh[]): void;
  frame(nowMs: number, camera: Vec3): void;
  tintAt(at: Vec3, out: Color3): Color3;
  blobs(material: Material, lengthM: number, widthM: number): Blobs;
  cardYaw(): number;
}

const luminance = (c: Color3) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

export function createSky(scene: Scene): Sky {
  scene.fogMode = Scene.FOGMODE_EXP2;
  const skyLight = new HemisphericLight("sky-light", new Vector3(0, 1, 0), scene);
  // Glints come from the sun or moon only (water/), not a white sheen from the whole sky.
  skyLight.specular = Color3.Black();
  const body = new DirectionalLight("sky-body", new Vector3(0, -1, 0), scene);
  body.shadowMinZ = 1;
  body.shadowMaxZ = 90;
  const bodyShadows = new ShadowGenerator(2048, body);
  bodyShadows.usePercentageCloserFiltering = true;
  bodyShadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  bodyShadows.bias = 0.002;
  bodyShadows.normalBias = 0.02;
  bodyShadows.darkness = 0.35;

  const disc = (name: string, { color, radiusM }: { color: Color3; radiusM: number }) => {
    const mesh = MeshBuilder.CreateDisc(name, { radius: radiusM, tessellation: 32 }, scene);
    const m = new StandardMaterial(name, scene);
    m.disableLighting = true;
    m.fogEnabled = false;
    m.emissiveColor = color.clone();
    mesh.material = m;
    mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    mesh.infiniteDistance = true;
    mesh.isPickable = false;
    return { mesh, m };
  };
  const sunDisc = disc("sun-disc", SUN_DISC), moonDisc = disc("moon-disc", MOON_DISC);

  const casters = new Set<AbstractMesh>(), watched = new WeakSet<AbstractMesh>();
  let place: SkyLook | null = null;
  // Kept and reused between looks: making or dropping a light makes every material in the scene check its shaders.
  const pool: Lamp[] = [];
  let lamps: (Lamp & { def: MapLight })[] = [];
  let shadowed: number[] = [];
  let direct = directLightAt(0);
  const lighting: Lighting = { skyBrightness: 0, direct: { toLight: direct.toLight, brightness: 0 }, lamps: [] };
  let materialCount = 0;
  const maxLights = 2 + MAX_MAP_LIGHTS;

  return {
    look(look, lights) {
      place = look;
      shadowed = [];
      lamps = lights.slice(0, MAX_MAP_LIGHTS).map((def, i) => {
        let lamp = pool[i];
        if (!lamp) {
          const light = new PointLight(`map-light-${i}`, Vector3.Zero(), scene);
          light.specular = Color3.Black();
          const shadows = new ShadowGenerator(POINT_SHADOW_MAP_PX, light);
          shadows.usePoissonSampling = true;
          shadows.darkness = 0.3;
          pool.push(lamp = { light, shadows });
        }
        const { light, shadows } = lamp;
        light.position.set(def.at.x, def.at.y, def.at.z);
        light.diffuse = def.color.clone();
        light.range = def.rangeM;
        light.shadowMaxZ = def.rangeM;
        light.shadowEnabled = false;
        light.setEnabled(true);
        shadows.getShadowMap()!.renderList!.length = 0;
        for (const mesh of casters) shadows.addShadowCaster(mesh);
        return { def, ...lamp };
      });
      for (const { light } of pool.slice(lamps.length)) light.setEnabled(false);
    },

    tint(look) {
      place = look;
    },

    castShadows(mesh, only) {
      if (only === "direct") bodyShadows.addShadowCaster(mesh);
      else if (only) lamps.find((l) => l.def === only)?.shadows.addShadowCaster(mesh);
      else if (!casters.has(mesh)) {
        casters.add(mesh);
        if (!watched.has(mesh)) {
          watched.add(mesh);
          mesh.onDisposeObservable.addOnce(() => casters.delete(mesh));
        }
        bodyShadows.addShadowCaster(mesh);
        for (const lamp of lamps) lamp.shadows.addShadowCaster(mesh);
      }
    },

    dropShadows(meshes) {
      const gone = new Set(meshes);
      for (const m of meshes) casters.delete(m);
      for (const { shadows } of [{ shadows: bodyShadows }, ...pool]) {
        const list = shadows.getShadowMap()!.renderList!;
        let kept = 0;
        for (const m of list) if (!gone.has(m)) list[kept++] = m;
        list.length = kept;
      }
    },

    clearShadows() {
      casters.clear();
      for (const { shadows } of [{ shadows: bodyShadows }, ...lamps]) shadows.getShadowMap()!.renderList!.length = 0;
    },

    frame(nowMs, camera) {
      if (scene.materials.length !== materialCount) {
        materialCount = scene.materials.length;
        for (const m of scene.materials as Material[]) {
          if (m instanceof StandardMaterial && m.maxSimultaneousLights < maxLights) m.maxSimultaneousLights = maxLights;
        }
      }
      const fraction = dayFractionAt(nowMs);
      direct = directLightAt(fraction);
      const day = daylightAt(fraction);
      const { toLight } = direct;
      body.direction.set(-toLight.x, -toLight.y, -toLight.z);
      body.position.set(toLight.x * BODY_DISTANCE_M, toLight.y * BODY_DISTANCE_M, toLight.z * BODY_DISTANCE_M);
      if (place) {
        const sky = place.sky.multiply(day.sky);
        scene.clearColor = new Color4(sky.r, sky.g, sky.b, 1);
        scene.fogColor = sky;
        scene.fogDensity = place.fogDensity;
        scene.ambientColor = place.ambient.multiply(day.skyLight);
        skyLight.diffuse = place.skyLight.color.multiply(day.skyLight);
        skyLight.groundColor = place.skyLight.ground.multiply(day.skyLight);
        skyLight.intensity = place.skyLight.intensity * day.skyLightScale;
        const sunLit = direct.body === "sun";
        body.diffuse = sunLit ? place.sun.color.multiply(day.sunTint) : MOONLIGHT.color.clone();
        body.specular = body.diffuse;
        body.intensity = direct.strength * (sunLit ? place.sun.intensity : MOONLIGHT.intensity);
      }

      const sun = sunAt(fraction), moon = moonAt(fraction);
      sunDisc.mesh.position.set(sun.x * DISC_DISTANCE_M, sun.y * DISC_DISTANCE_M, sun.z * DISC_DISTANCE_M);
      sunDisc.mesh.visibility = day.sunDiscAlpha;
      SUN_DISC.color.multiplyToRef(day.sunTint, sunDisc.m.emissiveColor);
      moonDisc.mesh.position.set(moon.x * DISC_DISTANCE_M, moon.y * DISC_DISTANCE_M, moon.z * DISC_DISTANCE_M);
      moonDisc.mesh.visibility = day.moonDiscAlpha;

      const seconds = nowMs / 1000;
      lamps.forEach(({ def, light }, i) => {
        const waver = 0.6 * Math.sin(seconds * FLICKER_RAD_PER_SEC[0] + i * 2.1)
          + 0.4 * Math.sin(seconds * FLICKER_RAD_PER_SEC[1] + i);
        light.intensity = def.intensity * (1 + def.flicker * waver);
      });
      shadowed = nearestLights(lamps.map((l) => l.def.at), camera, SHADOW_MAP_LIGHTS, shadowed);
      lamps.forEach(({ light }, i) => {
        if (light.shadowEnabled !== shadowed.includes(i)) light.shadowEnabled = !light.shadowEnabled;
      });
      lighting.skyBrightness = skyLight.intensity * luminance(skyLight.diffuse);
      lighting.direct = { toLight, brightness: body.intensity * luminance(body.diffuse) };
      lighting.lamps = lamps.map(({ def, light }) => ({
        at: def.at, rangeM: def.rangeM, brightness: light.intensity * luminance(light.diffuse),
      }));
    },

    tintAt(at, out) {
      out.copyFrom(skyLight.diffuse).scaleInPlace(skyLight.intensity * SPRITE_LIGHT.sky);
      body.diffuse.scaleAndAddToRef(body.intensity * SPRITE_LIGHT.direct, out);
      for (const { def, light } of lamps) {
        const near = 1 - Math.hypot(at.x - def.at.x, at.y - def.at.y, at.z - def.at.z) / def.rangeM;
        if (near > 0) light.diffuse.scaleAndAddToRef(light.intensity * near * SPRITE_LIGHT.map, out);
      }
      return out.clampToRef(0, 1, out);
    },

    blobs: (material, lengthM, widthM) => createBlobs(scene, lighting, material, lengthM, widthM),
    cardYaw: () => cardYawRad(direct.toLight),
  };
}
