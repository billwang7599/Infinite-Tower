import {
  Color3, Constants, Matrix, MeshBuilder, ShaderMaterial, StandardMaterial, type Mesh, type Scene,
} from "@babylonjs/core";
import { SHADER_LOOKS, type LookKey } from "./looks.js";

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
