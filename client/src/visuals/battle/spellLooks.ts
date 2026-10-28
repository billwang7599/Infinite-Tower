import {
  Color3, Color4, Constants, Matrix, Mesh, MeshBuilder, ParticleSystem, ShaderMaterial, StandardMaterial, Vector3,
  type BaseTexture, type InstancedMesh, type Scene,
} from "@babylonjs/core";
import { seededRandom, type SpellElement, type Vec3 } from "@infinite-tower/shared";
import { glowTexture, puffTexture } from "../textures.js";

export type LookKey = SpellElement | "none";
export type ParticleKey = LookKey | "steam";

export interface ShaderLook {
  // Above 1 so the bloom catches it.
  core: Color3;
  edge: Color3;
  // How much the noise breaks the shape up (0 smooth, 1 ragged), and how fast it moves.
  rough: number;
  flowPerSec: number;
  // Drawn over what's behind (smoke) instead of adding light to it.
  dark?: boolean;
}

export interface ParticleLook {
  colors: [Color4, Color4, Color4];
  sizeM: [number, number];
  lifeS: [number, number];
  speedMps: [number, number];
  gravityMps2: number;
  smoke?: boolean;
}

const c3 = (r: number, g: number, b: number) => new Color3(r, g, b);
const c4 = (r: number, g: number, b: number, a: number) => new Color4(r, g, b, a);

export const SHADER_LOOKS: Record<LookKey, ShaderLook> = {
  fire: { core: c3(2.2, 0.85, 0.15), edge: c3(1.1, 0.22, 0.04), rough: 0.75, flowPerSec: 2.2 },
  water: { core: c3(0.35, 1, 2.3), edge: c3(0.08, 0.3, 0.9), rough: 0.45, flowPerSec: 0.9 },
  earth: { core: c3(1.1, 0.6, 0.25), edge: c3(0.3, 0.17, 0.07), rough: 0.85, flowPerSec: 0.35 },
  air: { core: c3(0.95, 1.9, 1.6), edge: c3(0.35, 0.65, 0.7), rough: 0.6, flowPerSec: 3 },
  lightning: { core: c3(1.8, 1.6, 0.35), edge: c3(0.55, 0.45, 1.6), rough: 0.9, flowPerSec: 6 },
  light: { core: c3(2, 1.7, 0.8), edge: c3(1.2, 0.9, 0.4), rough: 0.25, flowPerSec: 0.6 },
  darkness: { core: c3(0.04, 0, 0.08), edge: c3(0.55, 0.12, 0.9), rough: 0.7, flowPerSec: 0.8, dark: true },
  none: { core: c3(1.25, 1, 2.1), edge: c3(0.4, 0.35, 0.75), rough: 0.4, flowPerSec: 1.2 },
};

export const PARTICLE_LOOKS: Record<ParticleKey, ParticleLook> = {
  fire: {
    colors: [c4(1, 0.75, 0.25, 1), c4(1, 0.3, 0.05, 1), c4(0.3, 0.05, 0, 0)],
    sizeM: [0.12, 0.35], lifeS: [0.3, 0.7], speedMps: [0.5, 1.5], gravityMps2: 5,
  },
  water: {
    colors: [c4(0.6, 0.85, 1, 0.9), c4(0.2, 0.5, 1, 0.8), c4(0.1, 0.2, 0.6, 0)],
    sizeM: [0.06, 0.16], lifeS: [0.4, 0.8], speedMps: [1, 2.5], gravityMps2: -9,
  },
  earth: {
    colors: [c4(0.55, 0.42, 0.28, 0.9), c4(0.4, 0.3, 0.2, 0.7), c4(0.3, 0.24, 0.18, 0)],
    sizeM: [0.08, 0.3], lifeS: [0.5, 1], speedMps: [0.5, 2], gravityMps2: -6, smoke: true,
  },
  air: {
    colors: [c4(0.85, 1, 1, 0.5), c4(0.6, 0.9, 0.95, 0.35), c4(0.5, 0.8, 0.9, 0)],
    sizeM: [0.2, 0.5], lifeS: [0.25, 0.5], speedMps: [3, 6], gravityMps2: 0,
  },
  lightning: {
    colors: [c4(1, 1, 0.8, 1), c4(0.7, 0.6, 1, 1), c4(0.4, 0.3, 1, 0)],
    sizeM: [0.04, 0.12], lifeS: [0.1, 0.3], speedMps: [3, 7], gravityMps2: -3,
  },
  light: {
    colors: [c4(1, 0.95, 0.8, 1), c4(1, 0.85, 0.5, 0.8), c4(1, 0.8, 0.4, 0)],
    sizeM: [0.08, 0.22], lifeS: [0.5, 1.1], speedMps: [0.2, 0.8], gravityMps2: 1.5,
  },
  darkness: {
    colors: [c4(0.12, 0.02, 0.2, 0.85), c4(0.25, 0.05, 0.4, 0.6), c4(0.05, 0, 0.1, 0)],
    sizeM: [0.25, 0.6], lifeS: [0.5, 1], speedMps: [0.3, 1], gravityMps2: 0.8, smoke: true,
  },
  none: {
    colors: [c4(0.85, 0.85, 1, 0.9), c4(0.55, 0.5, 1, 0.6), c4(0.3, 0.25, 0.7, 0)],
    sizeM: [0.06, 0.16], lifeS: [0.4, 0.8], speedMps: [0.3, 1], gravityMps2: 0.5,
  },
  steam: {
    colors: [c4(0.95, 0.97, 1, 0.55), c4(0.8, 0.85, 0.9, 0.35), c4(0.7, 0.75, 0.8, 0)],
    sizeM: [0.4, 0.9], lifeS: [0.7, 1.3], speedMps: [0.5, 1.5], gravityMps2: 2.5, smoke: true,
  },
};

export const lookOf = (elements: readonly SpellElement[]): LookKey => elements[0] ?? "none";
export const particleKeysOf = (elements: readonly SpellElement[]): ParticleKey[] =>
  elements.length === 0 ? ["none"] : [...elements];

// Each mesh's `visibility` is its alpha.
export type ShaderMode = "flow" | "shell" | "circle" | "ring";

const VERTEX = `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
uniform mat4 world;
uniform mat4 worldViewProjection;
varying vec3 vPos;
varying vec3 vNormal;
varying vec2 vLocal;
void main() {
  vPos = (world * vec4(position, 1.0)).xyz;
  vNormal = normalize(mat3(world) * normal);
  vLocal = position.xz;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}`;

const FRAGMENT = `
precision highp float;
varying vec3 vPos;
varying vec3 vNormal;
varying vec2 vLocal;
uniform vec3 cameraPosition;
uniform float time;
uniform vec3 core;
uniform vec3 edge;
uniform float rough;
uniform float flow;
uniform float alpha;
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1) * 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
      mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1)), f.x), f.y),
    f.z);
}
float band(float x, float at, float halfWidth) { return 1.0 - smoothstep(0.0, halfWidth, abs(x - at)); }
void main() {
  vec3 p = vPos * 2.5 + vec3(0.0, -time * flow, time * flow * 0.6);
  float n = noise(p) * 0.6 + noise(p * 2.3 + 7.1) * 0.3 + noise(p * 5.1 + 3.7) * 0.1;
#if defined(CIRCLE)
  float r = length(vLocal), a = atan(vLocal.y, vLocal.x);
  float t = band(r, 0.93, 0.025) + band(r, 0.985, 0.01) + band(r, 0.66, 0.015);
  float turned = mod(a + time * 0.4, 6.2832) / 0.2618;
  float glyph = step(0.35, hash(vec3(floor(turned), floor(r * 28.0), 2.0))) * step(0.15, fract(turned));
  t += glyph * step(0.71, r) * step(r, 0.87) * 0.8;
  for (int k = 0; k < 2; k++) {
    float d = r * cos(mod(a - time * 0.3 + float(k) * 1.0472, 2.0944) - 1.0472);
    t += band(d, 0.33, 0.012) * step(r, 0.66);
  }
  t *= (0.7 + 0.6 * n) * step(r, 1.0);
#elif defined(RING)
  float r = length(vLocal);
  float t = smoothstep(0.5, 0.94, r) * (1.0 - smoothstep(0.94, 1.0, r)) * (0.4 + 1.2 * n);
#else
  float facing = abs(dot(normalize(vNormal), normalize(cameraPosition - vPos)));
#if defined(SHELL)
  float t = (pow(1.0 - facing, 1.8) + 0.12) * mix(1.0, n * 1.9, rough);
#else
  float t = pow(facing, 1.4) * mix(1.0, n * 1.9, rough);
#endif
#endif
  t = clamp(t, 0.0, 1.0);
  gl_FragColor = vec4(mix(edge, core, smoothstep(0.3, 0.9, t)), t * alpha);
}`;

// Unit shapes: a sphere of radius 1, a disc of radius 1 lying flat, a tube of radius 1 from z = 0 to 1, a lit rock.
export type Shape = "sphere" | "disc" | "tube" | "rock";

export interface SpellShaders {
  take(shape: Exclude<Shape, "rock">, mode: ShaderMode, look: LookKey): Mesh;
  rock(): Mesh;
  give(mesh: Mesh): void;
  tick(dtS: number): void;
}

export function createSpellShaders(scene: Scene): SpellShaders {
  const made = new Map<string, ShaderMaterial>();
  let timeS = 0;
  const material = (mode: ShaderMode, key: LookKey): ShaderMaterial => {
    const id = `${mode}-${key}`;
    let m = made.get(id);
    if (m) return m;
    const look = SHADER_LOOKS[key];
    m = new ShaderMaterial(`spell-${id}`, scene, { vertexSource: VERTEX, fragmentSource: FRAGMENT }, {
      attributes: ["position", "normal"],
      uniforms: ["world", "worldViewProjection", "cameraPosition", "time", "core", "edge", "rough", "flow", "alpha"],
      defines: mode === "flow" ? [] : [`#define ${mode.toUpperCase()}`],
      needAlphaBlending: true,
    });
    m.setColor3("core", look.core).setColor3("edge", look.edge).setFloat("rough", look.rough)
      .setFloat("flow", look.flowPerSec).setFloat("time", timeS);
    m.alphaMode = look.dark ? Constants.ALPHA_COMBINE : Constants.ALPHA_ADD;
    m.backFaceCulling = false;
    m.disableDepthWrite = true;
    const bound = m;
    m.onBindObservable.add((mesh) => bound.getEffect()?.setFloat("alpha", mesh.visibility));
    made.set(id, m);
    return m;
  };
  const templates: Record<Shape, Mesh> = {
    sphere: MeshBuilder.CreateSphere("spell-sphere", { diameter: 2, segments: 16 }, scene),
    disc: MeshBuilder.CreateDisc("spell-disc", { radius: 1, tessellation: 48 }, scene),
    tube: MeshBuilder.CreateCylinder("spell-tube", { height: 1, diameter: 2, tessellation: 16, cap: 0 }, scene),
    rock: MeshBuilder.CreatePolyhedron("spell-rock", { type: 2, size: 0.5 }, scene),
  };
  const stone = new StandardMaterial("spell-rock", scene);
  stone.diffuseColor = new Color3(0.45, 0.34, 0.24);
  stone.emissiveColor = new Color3(0.12, 0.06, 0.02);
  stone.specularColor = Color3.Black();
  templates.rock.material = stone;
  templates.disc.bakeTransformIntoVertices(Matrix.RotationX(Math.PI / 2));
  templates.tube.bakeTransformIntoVertices(Matrix.RotationX(Math.PI / 2).multiply(Matrix.Translation(0, 0, 0.5)));
  const idle: Record<Shape, Mesh[]> = { sphere: [], disc: [], tube: [], rock: [] };
  const reuse = (shape: Shape): Mesh => {
    const mesh = idle[shape].pop() ?? templates[shape].clone(`spell-${shape}`);
    mesh.metadata = shape;
    mesh.isPickable = false;
    mesh.visibility = 1;
    mesh.scaling.setAll(1);
    mesh.rotation.setAll(0);
    mesh.setEnabled(true);
    return mesh;
  };
  for (const template of Object.values(templates)) template.setEnabled(false);

  return {
    take(shape, mode, look) {
      const mesh = reuse(shape);
      mesh.material = material(mode, look);
      return mesh;
    },
    rock: () => reuse("rock"),
    give(mesh) {
      mesh.setEnabled(false);
      idle[mesh.metadata as Shape].push(mesh);
    },
    tick(dtS) {
      timeS = (timeS + dtS) % 1000;
      for (const m of made.values()) m.setFloat("time", timeS);
    },
  };
}

const CAPACITY = 160;

export interface SpellParticles {
  stream(key: ParticleKey, perSec: number, radiusM: number): ParticleSystem;
  release(system: ParticleSystem): void;
  burst(key: ParticleKey, at: Vec3, count: number, radiusM: number, speedFactor?: number): void;
  tick(dtS: number): void;
  clear(): void;
}

export function createSpellParticles(scene: Scene): SpellParticles {
  const glow = glowTexture(scene), puff = puffTexture(scene);
  const idle = new Map<ParticleKey, ParticleSystem[]>();
  const all: ParticleSystem[] = [];
  const bursting: { system: ParticleSystem; leftS: number }[] = [];

  const take = (key: ParticleKey, radiusM: number, speedFactor: number): ParticleSystem => {
    const look = PARTICLE_LOOKS[key];
    let system = idle.get(key)?.pop();
    if (!system) {
      system = new ParticleSystem(`spell-${key}`, CAPACITY, scene);
      const texture: BaseTexture = look.smoke ? puff : glow;
      system.particleTexture = texture;
      system.blendMode = look.smoke ? ParticleSystem.BLENDMODE_STANDARD : ParticleSystem.BLENDMODE_ADD;
      [system.color1, system.color2, system.colorDead] = look.colors;
      [system.minSize, system.maxSize] = look.sizeM;
      [system.minLifeTime, system.maxLifeTime] = look.lifeS;
      system.gravity = new Vector3(0, look.gravityMps2, 0);
      system.minAngularSpeed = -2;
      system.maxAngularSpeed = 2;
      system.updateSpeed = 1 / 60; // lifetimes and speeds in seconds at any frame rate
      system.emitter = new Vector3();
      all.push(system);
    }
    system.minEmitPower = look.speedMps[0] * speedFactor;
    system.maxEmitPower = look.speedMps[1] * speedFactor;
    system.createSphereEmitter(radiusM, 1);
    return system;
  };
  const give = (system: ParticleSystem) => {
    system.stop();
    const key = system.name.slice("spell-".length) as ParticleKey;
    const list = idle.get(key) ?? [];
    list.push(system);
    idle.set(key, list);
  };

  return {
    stream(key, perSec, radiusM) {
      const system = take(key, radiusM, 0.5);
      system.manualEmitCount = -1;
      system.emitRate = perSec;
      system.start();
      return system;
    },
    release: give,
    burst(key, at, count, radiusM, speedFactor = 1) {
      const system = take(key, radiusM, speedFactor);
      (system.emitter as Vector3).set(at.x, at.y, at.z);
      system.manualEmitCount = count;
      system.start();
      bursting.push({ system, leftS: PARTICLE_LOOKS[key].lifeS[1] + 0.1 });
    },
    tick(dtS) {
      for (let i = bursting.length - 1; i >= 0; i--) {
        const b = bursting[i]!;
        b.leftS -= dtS;
        if (b.leftS > 0) continue;
        give(b.system);
        bursting.splice(i, 1);
      }
    },
    clear() {
      for (const b of bursting) give(b.system);
      bursting.length = 0;
      for (const system of all) system.reset();
    },
  };
}

const SHAPES = 4;
const KINKS = 9;
const HALF_WIDTH_M = 0.025;

// Jagged strips 1 m long along +z, stretched between two points.
export interface Arcs {
  flash(from: Vec3, to: Vec3, lifeS: number): void;
  tick(dtS: number): void;
  clear(): void;
}

export function createArcs(scene: Scene): Arcs {
  const material = new StandardMaterial("spell-arc", scene);
  material.disableLighting = true;
  material.emissiveColor = new Color3(2.4, 2.3, 3);
  material.backFaceCulling = false;
  const rand = seededRandom(11);
  const shapes = Array.from({ length: SHAPES }, (_, s) => {
    const line = Array.from({ length: KINKS + 1 }, (_, i) => {
      const u = i / KINKS, sway = i === 0 || i === KINKS ? 0 : 0.14 * Math.sin(u * Math.PI);
      return new Vector3((rand() - 0.5) * sway * 2, (rand() - 0.5) * sway * 2, u);
    });
    const strip = (side: Vector3) => MeshBuilder.CreateRibbon(`arc-${s}`, {
      pathArray: [line.map((p) => p.subtract(side)), line.map((p) => p.add(side))],
    }, scene);
    const mesh = Mesh.MergeMeshes([strip(new Vector3(HALF_WIDTH_M, 0, 0)), strip(new Vector3(0, HALF_WIDTH_M, 0))])!;
    mesh.material = material;
    mesh.isPickable = false;
    mesh.setEnabled(false);
    return mesh;
  });
  const idle: InstancedMesh[] = [];
  const live: { arc: InstancedMesh; leftS: number }[] = [];
  const target = new Vector3();

  const give = (arc: InstancedMesh) => {
    arc.setEnabled(false);
    idle.push(arc);
  };
  return {
    flash(from, to, lifeS) {
      const shape = shapes[Math.floor(Math.random() * SHAPES)]!;
      const arc = idle.find((a) => a.sourceMesh === shape) ?? shape.createInstance("arc");
      if (idle.includes(arc)) idle.splice(idle.indexOf(arc), 1);
      arc.isPickable = false;
      arc.position.set(from.x, from.y, from.z);
      arc.lookAt(target.set(to.x, to.y, to.z));
      const lengthM = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
      const flip = Math.random() < 0.5 ? -1 : 1;
      arc.scaling.set(flip, flip, Math.max(0.01, lengthM));
      arc.setEnabled(true);
      live.push({ arc, leftS: lifeS });
    },
    tick(dtS) {
      for (let i = live.length - 1; i >= 0; i--) {
        const l = live[i]!;
        l.leftS -= dtS;
        if (l.leftS > 0) continue;
        give(l.arc);
        live.splice(i, 1);
      }
    },
    clear() {
      for (const l of live) give(l.arc);
      live.length = 0;
    },
  };
}
