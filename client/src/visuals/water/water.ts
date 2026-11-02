import {
  Color3, Material, MaterialPluginBase, RawTexture, ShaderLanguage, StandardMaterial, Texture, VertexBuffer,
  type Mesh, type Scene, type UniformBuffer,
} from "@babylonjs/core";
import { seededRandom } from "@infinite-tower/shared";

export interface WaterLook {
  body: Color3;
  /** How fast the bed fades from view, per tile of water the eye looks through. */
  murkPerTile: number;
  /** Mirrored share of the sky looking straight down; more toward the horizon (fresnel). */
  reflectivity: number;
  glint: Color3;
  rippleSlope: number;
  waveHeightTiles: number;
  foam: Color3;
  foamTiles: number;
}

/** Per vertex: the current (tiles a second), how far the bank is and how deep the water (tiles). */
export interface WaterPoint { flowX: number; flowZ: number; shore: number; column: number }

// The texture is sampled twice, the second turned and at another scale, so its repeat never shows.
const RIPPLE = {
  px: 256, waves: 160, wavesAcross: { min: 4, max: 40 }, tiles: 7.3, turnedTiles: 4.7, turnRad: 1.1, turnedShare: 0.7,
  flowCycleSec: 1, stillCycleSec: 3,
};
// Each cell of still water gets a ring in a slot with this chance, at a random spot and time in it.
const RINGS = {
  cellTiles: 4, slotSec: 6, chance: 0.35, lifeSec: 2.4, reachTiles: 1.1, widthTiles: 0.5, crestsApartTiles: 0.2,
  slope: 3,
};
const GLINT_POWER = 220;
// Every period in the shader divides it, so the clock's wrap never shows.
const LOOP_SEC = 1200;

export function waterMaterial(scene: Scene, name: string, look: WaterLook): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = look.body;
  m.specularColor = look.glint;
  m.specularPower = GLINT_POWER;
  m.transparencyMode = Material.MATERIAL_ALPHABLEND;
  new WaterPlugin(m, look, rippleTexture(scene));
  return m;
}

export function setWater(mesh: Mesh, at: (x: number, z: number) => WaterPoint): void {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!, count = positions.length / 3;
  const flow = new Float32Array(count * 2), shore = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const p = at(positions[i * 3]!, positions[i * 3 + 2]!);
    flow.set([p.flowX, p.flowZ], i * 2);
    shore.set([p.shore, p.column], i * 2);
  }
  mesh.setVerticesData("waterFlow", flow, false, 2);
  mesh.setVerticesData("waterShore", shore, false, 2);
}

const UNIFORMS = `uniform float waterTime;
uniform vec3 waterSky;
uniform vec4 waterLook;
uniform vec4 waterFoam;`;

// waterLook: murk per tile, reflectivity, wave height, ripple slope. waterFoam: colour, width in tiles.
// The waves stand (they rise and fall in place), so still water never seems to drift.
const WAVE = `vec3 waterWave(vec2 p, float t) {
  const vec2 k1 = vec2(1.9, 1.2), k2 = vec2(-1.1, 2.6);
  float a1 = dot(k1, p), a2 = dot(k2, p), b1 = 0.6 * cos(t * 2.6179939), b2 = 0.4 * cos(t * 2.0943951);
  return vec3(b1 * sin(a1) + b2 * sin(a2), b1 * cos(a1) * k1 + b2 * cos(a2) * k2);
}
float waterCalm(float shore) { return clamp(shore * 2.0, 0.0, 1.0); }`;

const VERTEX = {
  CUSTOM_VERTEX_DEFINITIONS: `attribute vec2 waterFlow;
attribute vec2 waterShore;
varying vec2 vWaterFlow;
varying vec2 vWaterShore;
${WAVE}`,
  CUSTOM_VERTEX_UPDATE_WORLDPOS: `worldPos.y += waterLook.z * waterCalm(waterShore.x) * waterWave(worldPos.xz, waterTime).x;
vWaterFlow = waterFlow;
vWaterShore = waterShore;`,
};

// Two-phase flow mapping: each phase slides the ripples along the current and fades out as it jumps back, shifted
// (LOOP_SEC / cycle jumps make a whole shift). Dividing by the weights' length keeps the contrast from pulsing.
const [TURN_COS, TURN_SIN] = [Math.cos(RIPPLE.turnRad).toFixed(4), Math.sin(RIPPLE.turnRad).toFixed(4)];
const FRAGMENT = {
  CUSTOM_FRAGMENT_DEFINITIONS: `uniform sampler2D waterRipples;
varying vec2 vWaterFlow;
varying vec2 vWaterShore;
${WAVE}
vec3 waterLayers(vec2 p, vec2 shift) {
  const mat2 turn = mat2(${TURN_COS}, ${TURN_SIN}, -${TURN_SIN}, ${TURN_COS});
  const float share = ${RIPPLE.turnedShare.toFixed(2)};
  vec4 a = texture2D(waterRipples, p / ${RIPPLE.tiles.toFixed(2)} + shift);
  vec4 b = texture2D(waterRipples, turn * p / ${RIPPLE.turnedTiles.toFixed(2)} - shift);
  return vec3(a.rg * 2.0 - 1.0 + (b.rg * 2.0 - 1.0) * turn * share, (a.b - 0.5 + (b.b - 0.5) * share) / (1.0 + share));
}
vec3 waterRipple(vec2 p, vec2 drift, float t) {
  float cycle = drift == vec2(0.0) ? ${RIPPLE.stillCycleSec.toFixed(2)} : ${RIPPLE.flowCycleSec.toFixed(2)};
  float c = t / cycle, a = fract(c), b = fract(c + 0.5), wa = 1.0 - abs(1.0 - 2.0 * a), wb = 1.0 - wa;
  const vec2 jump = vec2(0.25, 0.36);
  return (waterLayers(p - drift * a * cycle, floor(c) * jump) * wa
    + waterLayers(p - drift * b * cycle, floor(c + 0.5) * jump + 0.5) * wb) / sqrt(wa * wa + wb * wb);
}
vec4 waterHash(vec4 p) {
  p = fract(p * vec4(0.1031, 0.103, 0.0973, 0.1099));
  p += dot(p, p.wzxy + 33.33);
  return fract((p.xxyz + p.yzzw) * p.zywx);
}
// The slot wraps with the clock, so no ring is cut short. A ring shows only where the bank is at least half as far as
// its centre, so one centred on land shows little or nothing.
vec2 waterRingSlope(vec2 p, float t, float shore) {
  const float cell = ${RINGS.cellTiles.toFixed(2)}, slot = ${RINGS.slotSec.toFixed(2)}, life = ${RINGS.lifeSec.toFixed(2)};
  const float slots = ${(LOOP_SEC / RINGS.slotSec).toFixed(1)}, reach = ${RINGS.reachTiles.toFixed(2)};
  const float width = ${RINGS.widthTiles.toFixed(2)};
  vec2 slope = vec2(0.0), first = floor(p / cell - 0.5);
  for (int i = 0; i < 2; i++) {
    for (int j = 0; j < 2; j++) {
      vec2 at = first + vec2(float(i), float(j));
      float shifted = t + waterHash(vec4(at, 0.0, 1.0)).x * slot;
      vec4 h = waterHash(vec4(at, mod(floor(shifted / slot), slots), 2.0));
      vec2 away = p - (at + h.yz) * cell;
      float age = mod(shifted, slot) - h.w * (slot - life), d = length(away), behind = age * reach / life - d;
      if (h.x < ${RINGS.chance.toFixed(2)} && age > 0.0 && age < life && behind > 0.0 && behind < width) {
        float fade = 1.0 - age / life, crest = sin(behind * ${(2 * Math.PI / RINGS.crestsApartTiles).toFixed(4)});
        float strength = sin(behind / width * 3.1415927) * fade * smoothstep(0.5 * d, 0.5 * d + 0.15, shore);
        slope += away / max(d, 0.001) * strength * crest * ${RINGS.slope.toFixed(2)};
      }
    }
  }
  return slope;
}`,
  CUSTOM_FRAGMENT_BEFORE_LIGHTS: `float waterCalmHere = waterCalm(vWaterShore.x);
vec3 waterR = waterRipple(vPositionW.xz, vWaterFlow, waterTime);
vec2 waterSlope = waterR.xy * waterLook.w + waterLook.z * waterCalmHere * waterWave(vPositionW.xz, waterTime).yz;
if (vWaterFlow == vec2(0.0)) waterSlope += waterRingSlope(vPositionW.xz, waterTime, vWaterShore.x);
normalW = normalize(vec3(-waterSlope.x, 1.0, -waterSlope.y));`,
  CUSTOM_FRAGMENT_BEFORE_FOG: `float waterCos = clamp(dot(normalW, viewDirectionW), 0.0, 1.0);
float waterFresnel = waterLook.y + (1.0 - waterLook.y) * pow(1.0 - waterCos, 3.0);
vec3 waterUp = reflect(-viewDirectionW, normalW);
vec3 waterMirror = waterSky * mix(2.8, 0.7, clamp(waterUp.y, 0.0, 1.0));
float waterThrough = exp(-waterLook.x * vWaterShore.y / max(viewDirectionW.y, 0.2));
vec3 waterLit = finalDiffuse * (1.0 - waterThrough) * (1.0 - waterFresnel) + waterMirror * waterFresnel + finalSpecular;
float waterSeen = waterThrough * (1.0 - waterFresnel);
float waterFoamAt = waterFoam.a > 0.0
  ? (1.0 - smoothstep(0.4, 1.0, vWaterShore.x / waterFoam.a - waterR.z * 2.2)) * 0.4 : 0.0;
waterLit = mix(waterLit, waterFoam.rgb * clamp(diffuseBase, 0.0, 1.0), waterFoamAt);
waterSeen *= 1.0 - waterFoamAt;
color = vec4(waterLit / max(1.0 - waterSeen, 0.001), 1.0 - waterSeen);`,
};

class WaterPlugin extends MaterialPluginBase {
  constructor(material: StandardMaterial, private readonly look: WaterLook, private readonly ripples: Texture) {
    super(material, "Water", 200, undefined, true, true);
  }

  override getClassName(): string {
    return "WaterPlugin";
  }

  override isCompatible(language: ShaderLanguage): boolean {
    return language === ShaderLanguage.GLSL;
  }

  override isReadyForSubMesh(): boolean {
    return this.ripples.isReady();
  }

  override getUniforms() {
    return {
      ubo: [
        { name: "waterTime", size: 1, type: "float" }, { name: "waterSky", size: 3, type: "vec3" },
        { name: "waterLook", size: 4, type: "vec4" }, { name: "waterFoam", size: 4, type: "vec4" },
      ],
      vertex: UNIFORMS,
      fragment: UNIFORMS,
    };
  }

  override getSamplers(samplers: string[]): void {
    samplers.push("waterRipples");
  }

  override getAttributes(attributes: string[]): void {
    attributes.push("waterFlow", "waterShore");
  }

  override bindForSubMesh(ubo: UniformBuffer, scene: Scene): void {
    const { look } = this;
    ubo.updateFloat("waterTime", (performance.now() / 1000) % LOOP_SEC);
    ubo.updateColor3("waterSky", scene.fogColor);
    ubo.updateFloat4("waterLook", look.murkPerTile, look.reflectivity, look.waveHeightTiles, look.rippleSlope);
    ubo.updateFloat4("waterFoam", look.foam.r, look.foam.g, look.foam.b, look.foamTiles);
    ubo.setTexture("waterRipples", this.ripples);
  }

  override getCustomCode(shaderType: string): Record<string, string> {
    return shaderType === "vertex" ? VERTEX : FRAGMENT;
  }

  override dispose(): void {
    this.ripples.dispose();
  }
}

function rippleTexture(scene: Scene): Texture {
  const tex = RawTexture.CreateRGBATexture(ripplePixels ??= paintRipples(), RIPPLE.px, RIPPLE.px, scene, true, false,
    Texture.TRILINEAR_SAMPLINGMODE);
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}

let ripplePixels: Uint8Array | undefined;

// A sum of sines with whole wave numbers, so it tiles: rg its slope (scaled to fit), b its height. Each sine is split
// into a row's and a column's part (sin(a + b)), so there's no trig per texel.
function paintRipples(): Uint8Array {
  const { px, waves, wavesAcross: { min, max } } = RIPPLE, rand = seededRandom(17), tau = Math.PI * 2;
  const height = new Float32Array(px * px), slopeX = new Float32Array(px * px), slopeZ = new Float32Array(px * px);
  const sinA = new Float32Array(px), cosA = new Float32Array(px);
  for (let w = 0; w < waves; w++) {
    const turn = rand() * tau, across = min * (max / min) ** rand(), phase = rand() * tau;
    const m = Math.round(Math.cos(turn) * across), n = Math.round(Math.sin(turn) * across);
    const amp = Math.hypot(m, n) ** -1.4;
    for (let i = 0; i < px; i++) {
      sinA[i] = Math.sin(tau * m * i / px + phase);
      cosA[i] = Math.cos(tau * m * i / px + phase);
    }
    for (let j = 0; j < px; j++) {
      const sinB = Math.sin(tau * n * j / px), cosB = Math.cos(tau * n * j / px);
      for (let i = 0; i < px; i++) {
        const k = j * px + i, sin = sinA[i]! * cosB + cosA[i]! * sinB, cos = cosA[i]! * cosB - sinA[i]! * sinB;
        height[k]! += amp * sin;
        slopeX[k]! += amp * m * cos;
        slopeZ[k]! += amp * n * cos;
      }
    }
  }
  let maxSlope = 0, low = Infinity, high = -Infinity;
  for (let k = 0; k < px * px; k++) {
    maxSlope = Math.max(maxSlope, Math.abs(slopeX[k]!), Math.abs(slopeZ[k]!));
    low = Math.min(low, height[k]!);
    high = Math.max(high, height[k]!);
  }
  const data = new Uint8Array(px * px * 4);
  for (let k = 0; k < px * px; k++) {
    data[k * 4] = Math.round((slopeX[k]! / maxSlope * 0.5 + 0.5) * 255);
    data[k * 4 + 1] = Math.round((slopeZ[k]! / maxSlope * 0.5 + 0.5) * 255);
    data[k * 4 + 2] = Math.round(((height[k]! - low) / (high - low)) * 255);
    data[k * 4 + 3] = 255;
  }
  return data;
}
