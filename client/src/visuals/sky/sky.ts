import {
  Color3, Color4, DirectionalLight, HemisphericLight, Mesh, MeshBuilder, PointLight, ShadowGenerator,
  Scene, StandardMaterial, Vector3, type AbstractMesh, type Material,
} from "@babylonjs/core";
import {
  clamp, dayFraction, moonAt, retimeDay, sunAt, WALL_CLOCK, type DayChange, type DayClock, type Vec3,
} from "@infinite-tower/shared";

export interface SkyLook {
  sky: Color3;
  fogDensity: number;
  ambient: Color3;
  skyLight: { color: Color3; ground: Color3; intensity: number };
  sun: { color: Color3; intensity: number };
}

/** `flicker`: how far its brightness wavers, as a share. */
export interface MapLight { at: Vec3; color: Color3; intensity: number; rangeM: number; flicker: number }

interface DirectLight { body: "sun" | "moon"; toLight: Vec3; strength: number }

export const MOONLIGHT = { color: new Color3(0.6, 0.7, 1), intensity: 0.6 };
export const MAX_MAP_LIGHTS = 4;
export const SHADOW_MAP_LIGHTS = 2;
/** A map light keeps its shadows until another is this much nearer the camera, so shaders don't swap back and forth. */
export const SHADOW_SWAP_MARGIN_M = 2;
const SUN_FADE_DEG = [-1, 5] as const;
const DUSK_FADE_DEG = [-8, -1] as const;
const MOON_FADE_DEG = [0, 6] as const;

const DAYLIGHT = [
  { altDeg: -12, sky: [0.32, 0.38, 0.62], skyLight: [0.62, 0.72, 1], skyLightScale: 1, sunTint: [1, 0.6, 0.4] },
  { altDeg: -4, sky: [0.7, 0.55, 0.66], skyLight: [0.85, 0.75, 0.92], skyLightScale: 1.5, sunTint: [1, 0.6, 0.4] },
  { altDeg: 4, sky: [1.1, 0.88, 0.75], skyLight: [1, 0.9, 0.82], skyLightScale: 2, sunTint: [1.05, 0.82, 0.64] },
  { altDeg: 20, sky: [1, 1, 1], skyLight: [1, 1, 1], skyLightScale: 1.3, sunTint: [1, 1.06, 1.15] },
  { altDeg: 45, sky: [1, 1, 1], skyLight: [1, 1, 1], skyLightScale: 1, sunTint: [1, 1.12, 1.3] },
] as const;

const BLOB = { contactAlpha: 0.45, alphaPerShare: 1.6, minAlpha: 0.05, stretchPerCot: 0.5, maxStretch: 2.6 };
const SPRITE_LIGHT = { sky: 1.3, direct: 0.7, map: 0.6 };
const SUN_DISC = { color: new Color3(3, 2.6, 2), radiusM: 5 };
const MOON_DISC = { color: new Color3(1.2, 1.3, 1.5), radiusM: 3.5 };
const DISC_DISTANCE_M = 400;
const BODY_DISTANCE_M = 40;
const POINT_SHADOW_MAP_PX = 512;
const FLICKER_RAD_PER_SEC = [7.3, 13.1] as const;

let clock: DayClock = WALL_CLOCK;

export function setDayClock(change: DayChange): void {
  clock = retimeDay(clock, Date.now(), change);
}

const altitudeDeg = (v: Vec3) => (Math.asin(clamp(v.y, -1, 1)) * 180) / Math.PI;
const smoothstep = ([lo, hi]: readonly [number, number], x: number) => {
  const t = clamp((x - lo) / (hi - lo), 0, 1);
  return t * t * (3 - 2 * t);
};

export function directLightAt(fraction: number): DirectLight {
  const sun = sunAt(fraction), sunAlt = altitudeDeg(sun);
  const sunUp = smoothstep(SUN_FADE_DEG, sunAlt);
  if (sunUp > 0) return { body: "sun", toLight: sun, strength: sunUp };
  const moon = moonAt(fraction);
  return { body: "moon", toLight: moon, strength: (1 - smoothstep(DUSK_FADE_DEG, sunAlt)) * smoothstep(MOON_FADE_DEG,
    altitudeDeg(moon)) };
}

export function daylightAt(fraction: number) {
  const alt = altitudeDeg(sunAt(fraction));
  const i = DAYLIGHT.findIndex((k) => k.altDeg > alt);
  const a = DAYLIGHT[i <= 0 ? 0 : i - 1]!, b = DAYLIGHT[i < 0 ? DAYLIGHT.length - 1 : i]!;
  const t = a === b ? 0 : (alt - a.altDeg) / (b.altDeg - a.altDeg);
  const mix = (x: readonly number[], y: readonly number[]) =>
    new Color3(x[0]! + (y[0]! - x[0]!) * t, x[1]! + (y[1]! - x[1]!) * t, x[2]! + (y[2]! - x[2]!) * t);
  return {
    sky: mix(a.sky, b.sky), skyLight: mix(a.skyLight, b.skyLight), sunTint: mix(a.sunTint, b.sunTint),
    skyLightScale: a.skyLightScale + (b.skyLightScale - a.skyLightScale) * t,
  };
}

export interface BlobShadow { yawRad: number; stretch: number; shift: { x: number; z: number }; alpha: number }

/** Brightness is a light's intensity × its colour's luminance. */
export interface Lighting {
  skyBrightness: number;
  direct: { toLight: Vec3; brightness: number };
  lamps: { at: Vec3; brightness: number; rangeM: number }[];
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

export function cardYawRad(toLight: Vec3): number {
  return Math.atan2(toLight.x, toLight.z);
}

export function nearestLights(spots: Vec3[], camera: Vec3, count: number, current: number[]): number[] {
  const biased = spots.map((s, i) =>
    Math.hypot(s.x - camera.x, s.y - camera.y, s.z - camera.z) - (current.includes(i) ? SHADOW_SWAP_MARGIN_M : 0));
  return spots.map((_, i) => i).sort((a, b) => biased[a]! - biased[b]!).slice(0, count).sort((a, b) => a - b);
}

interface Lamp { def: MapLight; light: PointLight; shadows: ShadowGenerator }

export interface Blobs {
  place(ground: Vec3 | null, centreM: number, scale?: number): void;
  dispose(): void;
}

export interface Sky {
  look(look: SkyLook, lights: MapLight[]): void;
  /** `only`: cast by the sun or moon alone, or by that map light alone (a card turned to it). */
  castShadows(mesh: AbstractMesh, only?: "direct" | MapLight): void;
  frame(nowMs: number, camera: Vec3): void;
  tintAt(at: Vec3, out: Color3): Color3;
  blobs(material: Material, lengthM: number, widthM: number): Blobs;
  cardYaw(): number;
}

const luminance = (c: Color3) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

export function createSky(scene: Scene): Sky {
  scene.fogMode = Scene.FOGMODE_EXP2;
  const skyLight = new HemisphericLight("sky-light", new Vector3(0, 1, 0), scene);
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

  const casters = new Set<AbstractMesh>();
  let place: SkyLook | null = null;
  let lamps: Lamp[] = [];
  let shadowed: number[] = [];
  let direct = directLightAt(0);
  const lighting: Lighting = { skyBrightness: 0, direct: { toLight: direct.toLight, brightness: 0 }, lamps: [] };
  let materialCount = 0;
  const maxLights = 2 + MAX_MAP_LIGHTS;

  return {
    look(look, lights) {
      place = look;
      for (const lamp of lamps) {
        lamp.shadows.dispose();
        lamp.light.dispose();
      }
      shadowed = [];
      lamps = lights.slice(0, MAX_MAP_LIGHTS).map((def, i) => {
        const light = new PointLight(`map-light-${i}`, new Vector3(def.at.x, def.at.y, def.at.z), scene);
        light.diffuse = def.color.clone();
        light.specular = Color3.Black();
        light.range = def.rangeM;
        light.shadowMaxZ = def.rangeM;
        light.shadowEnabled = false;
        const shadows = new ShadowGenerator(POINT_SHADOW_MAP_PX, light);
        shadows.usePoissonSampling = true;
        shadows.darkness = 0.3;
        for (const mesh of casters) shadows.addShadowCaster(mesh);
        return { def, light, shadows };
      });
    },

    castShadows(mesh, only) {
      if (only === "direct") bodyShadows.addShadowCaster(mesh);
      else if (only) lamps.find((l) => l.def === only)?.shadows.addShadowCaster(mesh);
      else if (!casters.has(mesh)) {
        casters.add(mesh);
        mesh.onDisposeObservable.addOnce(() => casters.delete(mesh));
        bodyShadows.addShadowCaster(mesh);
        for (const lamp of lamps) lamp.shadows.addShadowCaster(mesh);
      }
    },

    frame(nowMs, camera) {
      if (scene.materials.length !== materialCount) {
        materialCount = scene.materials.length;
        for (const m of scene.materials as Material[]) {
          if (m instanceof StandardMaterial && m.maxSimultaneousLights < maxLights) m.maxSimultaneousLights = maxLights;
        }
      }
      const fraction = dayFraction(clock, nowMs);
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
        body.intensity = direct.strength * (sunLit ? place.sun.intensity : MOONLIGHT.intensity);
      }

      const sun = sunAt(fraction), moon = moonAt(fraction);
      sunDisc.mesh.position.set(sun.x * DISC_DISTANCE_M, sun.y * DISC_DISTANCE_M, sun.z * DISC_DISTANCE_M);
      sunDisc.mesh.visibility = smoothstep([-3, 1], altitudeDeg(sun));
      SUN_DISC.color.multiplyToRef(day.sunTint, sunDisc.m.emissiveColor);
      moonDisc.mesh.position.set(moon.x * DISC_DISTANCE_M, moon.y * DISC_DISTANCE_M, moon.z * DISC_DISTANCE_M);
      moonDisc.mesh.visibility = smoothstep([-3, 1], altitudeDeg(moon)) * (1 - 0.6 * smoothstep(SUN_FADE_DEG,
        altitudeDeg(sun)));

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

    blobs(material, lengthM, widthM) {
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
    },
    cardYaw: () => cardYawRad(direct.toLight),
  };
}
