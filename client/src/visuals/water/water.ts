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

const RIPPLE = { px: 128, waves: 48, tiles: 2.6, fineTiles: 0.95, fineShare: 0.55 };
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

// Two-phase flow mapping: each phase slides the ripples along the current for one cycle and fades out as it jumps
// back. The jump also shifts the pattern (500 jumps a loop, so 500 * shift is whole).
const FRAGMENT = {
  CUSTOM_FRAGMENT_DEFINITIONS: `uniform sampler2D waterRipples;
varying vec2 vWaterFlow;
varying vec2 vWaterShore;
${WAVE}
vec3 waterLayers(vec2 p, vec2 shift) {
  vec4 big = texture2D(waterRipples, p / ${RIPPLE.tiles.toFixed(2)} + shift);
  vec4 fine = texture2D(waterRipples, p.yx / ${RIPPLE.fineTiles.toFixed(2)} - shift);
  return vec3((big.rg * 2.0 - 1.0) + (fine.gr * 2.0 - 1.0) * ${RIPPLE.fineShare.toFixed(2)}, big.b);
}
vec3 waterRipple(vec2 p, vec2 drift, float t) {
  const float cycle = 2.4;
  float c = t / cycle, a = fract(c), b = fract(c + 0.5), wa = 1.0 - abs(1.0 - 2.0 * a);
  vec2 jump = vec2(0.25, 0.362);
  return waterLayers(p - drift * a * cycle, floor(c) * jump) * wa
    + waterLayers(p - drift * b * cycle, floor(c + 0.5) * jump + 0.5) * (1.0 - wa);
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
vec3 waterBody = finalDiffuse * (1.0 + 0.8 * smoothstep(0.55, 0.95, waterR.z));
vec3 waterLit = waterBody * (1.0 - waterThrough) * (1.0 - waterFresnel) + waterMirror * waterFresnel + finalSpecular;
float waterSeen = waterThrough * (1.0 - waterFresnel);
float waterFoamAt = waterFoam.a > 0.0
  ? (1.0 - smoothstep(0.4, 1.0, vWaterShore.x / waterFoam.a + (0.5 - waterR.z) * 2.2)) * 0.4 : 0.0;
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

// A sum of sines with whole wave numbers, so it tiles: rg its slope (scaled to fit), b its height.
function rippleTexture(scene: Scene): Texture {
  const { px, waves } = RIPPLE, rand = seededRandom(17), tau = Math.PI * 2;
  const spec = Array.from({ length: waves }, () => {
    const turn = rand() * tau, k = 3 + rand() * 7;
    const m = Math.round(Math.cos(turn) * k), n = Math.round(Math.sin(turn) * k);
    return { m, n, amp: Math.hypot(m, n) ** -1.6, phase: rand() * tau };
  }).filter((w) => w.m !== 0 || w.n !== 0);
  const slope = new Float32Array(px * px * 2), height = new Float32Array(px * px);
  let maxSlope = 0, low = Infinity, high = -Infinity;
  for (let j = 0; j < px; j++) {
    for (let i = 0; i < px; i++) {
      let h = 0, du = 0, dv = 0;
      for (const { m, n, amp, phase } of spec) {
        const a = tau * (m * i + n * j) / px + phase;
        h += amp * Math.sin(a);
        du += amp * m * Math.cos(a);
        dv += amp * n * Math.cos(a);
      }
      const k = j * px + i;
      slope[k * 2] = du;
      slope[k * 2 + 1] = dv;
      height[k] = h;
      maxSlope = Math.max(maxSlope, Math.abs(du), Math.abs(dv));
      low = Math.min(low, h);
      high = Math.max(high, h);
    }
  }
  const data = new Uint8Array(px * px * 4);
  for (let k = 0; k < px * px; k++) {
    data[k * 4] = Math.round((slope[k * 2]! / maxSlope * 0.5 + 0.5) * 255);
    data[k * 4 + 1] = Math.round((slope[k * 2 + 1]! / maxSlope * 0.5 + 0.5) * 255);
    data[k * 4 + 2] = Math.round(((height[k]! - low) / (high - low)) * 255);
    data[k * 4 + 3] = 255;
  }
  const tex = RawTexture.CreateRGBATexture(data, px, px, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}
