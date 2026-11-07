import {
  Constants, Effect, EffectRenderer, EffectWrapper, GeometryBufferRenderer, PostProcess,
  type AbstractMesh, type Camera, type Scene,
} from "@babylonjs/core";
import { ACCENTS, DYES, EYES, FIXED, HAIR, SKIN, type Ramp } from "../../gfx/look/palette.js";
import { sunRays } from "../sky/rays.js";
import type { Sky } from "../sky/sky.js";

export interface PixelFlags {
  scale: number | "auto" | null;
  fixed: boolean;
  outline: boolean;
  palette: "ramps" | "bands" | null;
  player3d: boolean;
  /** The 3D player's pose changes only this many times a second, as a drawn animation's frames. */
  steps: number | null;
  aa: boolean;
}

// 2 × 8 m (the camera to the player, measured) × tan(fov / 2) × 64 texels / 1.8 m: a sprite texel per low-res line.
export const LOW_RES_LINES = 275;
export const DEFAULT_PIXEL_SCALE = 3;
export const PIXEL_DEPTH = { fullSizeM: 8, fovRad: 0.9 };
const MAX_PIXEL_SIZE = 8;
/** fartherPerPx: how much farther (a share of the depth) a neighbour a screen pixel away is, to outline. */
const OUTLINE = { fartherPerPx: 0.08 / 3, creaseAt: 0.35, edgeShade: 0.3, creaseShade: 0.65 };

export function pixelFlags(search: string): PixelFlags {
  const params = new URLSearchParams(search);
  const pixel = params.get("pixel"), n = Math.round(Number(pixel));
  const palette = params.get("palette"), steps = Math.round(Number(params.get("steps")));
  const byDefault = pixel === null || pixel === "fixed";
  return {
    scale: byDefault ? DEFAULT_PIXEL_SCALE : pixel === "" || pixel === "auto" ? "auto" : n >= 2 ? n : null,
    fixed: pixel === "fixed",
    outline: params.get("outline") !== "0",
    palette: palette === null ? null : palette === "bands" ? "bands" : "ramps",
    player3d: params.get("player3d") !== "0",
    steps: steps >= 1 ? steps : null,
    aa: params.get("aa") !== "0",
  };
}

export function pixelScale(flags: PixelFlags, canvasHeightPx: number): number {
  if (flags.scale === null) return 1;
  return flags.scale === "auto" ? Math.max(1, Math.round(canvasHeightPx / LOW_RES_LINES)) : flags.scale;
}

export const renderScale = (flags: PixelFlags, canvasHeightPx: number): number =>
  flags.fixed ? pixelScale(flags, canvasHeightPx) : 1;

/** Where the pixels shrink a screen pixel (m, nearest first): base × fullSizeM / depth keeps a model's pixel count. */
export function pixelBands(base: number, fovRad: number): number[] {
  const fullSizeM = PIXEL_DEPTH.fullSizeM * Math.tan(PIXEL_DEPTH.fovRad / 2) / Math.tan(fovRad / 2);
  return Array.from({ length: base - 1 }, (_, i) => base * fullSizeM / (base - i - 0.5));
}

export function rampTones(): [number, number, number][] {
  const ramps: Ramp[] = [SKIN, HAIR, EYES, DYES, ACCENTS, FIXED].flatMap((group) => Object.values(group));
  const hexes = [...new Set(ramps.flat())];
  return hexes.map((hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]);
}

// An s x s block shows the scene at its centre when the depth there is drawn at size s; a texel no block claims
// shows the block of its own size.
Effect.IncludesShadersStore["pixelBlock"] = `
uniform sampler2D depthSampler;
uniform vec2 size;
const float SKY = 1e6;
float depthAt(vec2 t) {
  float d = texture2D(depthSampler, (t + 0.5) / size).r;
  return d > 0.0 ? d : SKY;
}
#ifdef BY_DEPTH
uniform float base;
uniform float limits[MAX_SIZE];
float sizeAt(float depth) {
  float s = base;
  for (int i = 0; i < MAX_SIZE; i++) if (depth > limits[i]) s -= 1.0;
  return max(s, 1.0);
}
vec3 blockOf(vec2 t) {
  for (int i = 0; i < MAX_SIZE; i++) {
    float s = base - float(i);
    if (s < 2.0) break;
    vec2 c = floor(t / s) * s + floor(s / 2.0);
    if (sizeAt(depthAt(c)) == s) return vec3(c, s);
  }
  float own = sizeAt(depthAt(t));
  return vec3(floor(t / own) * own + floor(own / 2.0), own);
}
#else
vec3 blockOf(vec2 t) { return vec3(t, 1.0); }
#endif
`;

// Drawn into the scene over the opaque meshes, multiplying: each block takes the shade at its centre.
Effect.ShadersStore["pixelOutlineFragmentShader"] = `
precision highp float;
uniform sampler2D normalSampler;
uniform float farPerTexel;
#include<pixelBlock>
vec3 normalAt(vec2 t) {
  vec3 n = texture2D(normalSampler, (t + 0.5) / size).xyz;
#ifdef UNSIGNED_NORMALS
  return n * 2.0 - 1.0;
#else
  return n;
#endif
}
void main(void) {
  vec3 block = blockOf(floor(gl_FragCoord.xy));
  vec2 c = block.xy;
  float s = block.z, depth = depthAt(c);
  if (depth >= SKY) {
    gl_FragColor = vec4(1.0, 1.0, 1.0, 0.0);
    return;
  }
  vec3 normal = normalAt(c);
  float farther = 0.0, crease = 0.0;
  vec2 around[4];
  around[0] = vec2(1.0, 0.0); around[1] = vec2(-1.0, 0.0); around[2] = vec2(0.0, 1.0); around[3] = vec2(0.0, -1.0);
  for (int i = 0; i < 4; i++) {
    vec2 t = c + around[i] * s;
    float d = depthAt(t);
    farther = max(farther, d - depth);
    // Only the nearer side of a crease darkens, so it stays one pixel wide.
    if (d > depth - 0.05 * depth && d < SKY) crease = max(crease, 1.0 - dot(normal, normalAt(t)));
  }
  float shade = farther > farPerTexel * s * depth ? EDGE_SHADE : crease > CREASE_AT ? CREASE_SHADE : 1.0;
  gl_FragColor = vec4(vec3(shade), 0.0);
}`;

Effect.ShadersStore["pixelateFragmentShader"] = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
#include<pixelBlock>
void main(void) {
  vec3 block = blockOf(floor(vUV * size));
  float s = block.z;
#ifdef AVERAGE
  vec2 from = block.xy - floor(s / 2.0);
  vec4 sum = vec4(0.0);
  for (int y = 0; y < MAX_SIZE; y++) {
    if (float(y) >= s) break;
    for (int x = 0; x < MAX_SIZE; x++) {
      if (float(x) >= s) break;
      sum += texture2D(textureSampler, (from + vec2(float(x), float(y)) + 0.5) / size);
    }
  }
  gl_FragColor = sum / (s * s);
#else
  gl_FragColor = texture2D(textureSampler, (block.xy + 0.5) / size);
#endif
}`;

Effect.ShadersStore["pixelPaletteFragmentShader"] = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform vec3 tones[TONES];
vec3 hsv(vec3 c) {
  vec4 k = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, k.wz), vec4(c.gb, k.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
}
vec3 rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
void main(void) {
  vec4 color = texture2D(textureSampler, vUV);
#ifdef BANDS
  vec3 c = hsv(color.rgb);
  c.z = floor(c.z * 12.0 + 0.5) / 12.0;
  gl_FragColor = vec4(rgb(c), color.a);
#else
  vec3 best = color.rgb;
  float bestDist = 1e9;
  for (int i = 0; i < TONES; i++) {
    vec3 d = (tones[i] - color.rgb) * vec3(0.55, 0.75, 0.35);
    float dist = dot(d, d);
    if (dist < bestDist) { bestDist = dist; best = tones[i]; }
  }
  gl_FragColor = vec4(best, color.a);
#endif
}`;

const SHARP_GROUP = 1, ON_TOP_GROUP = 2;

/** Drawn after the outline, so a thin blade isn't all outline, but still in its depth, so nothing outlines through it. */
export function keepSharp(mesh: AbstractMesh): void {
  mesh.renderingGroupId = SHARP_GROUP;
}

/** Drawn over everything, after the outline and out of its depth: the swing's trail and the blade's glint. */
export function drawOnTop(mesh: AbstractMesh): void {
  mesh.renderingGroupId = ON_TOP_GROUP;
}

// The sky (its dome, sun and moon) stays out, so it reads as nothing drawn: no outline, and the rays' way out.
export const inDepthPass = (mesh: AbstractMesh): boolean => mesh.renderingGroupId <= SHARP_GROUP && !mesh.infiniteDistance;

export function drawOverOpaque(scene: Scene, draw: () => void): void {
  scene.setRenderingAutoClearDepthStencil(SHARP_GROUP, false);
  let pending = false;
  const once = () => {
    if (!pending) return;
    pending = false;
    draw();
  };
  scene.onBeforeRenderingGroupObservable.add(({ renderingGroupId, renderingManager }) => {
    pending = renderingGroupId === 0 && renderingManager === scene.renderingManager;
  });
  scene.onAfterRenderingGroupObservable.add(() => { pending = false; });
  scene.onBeforeParticlesRenderingObservable.add(once);
  scene.renderingManager.getRenderingGroup(0).onBeforeTransparentRendering = once;
}

export function pixelPost(scene: Scene, camera: Camera, flags: PixelFlags, sky: Sky): void {
  const engine = scene.getEngine(), byDepth = flags.scale !== null && !flags.fixed;
  const gbuffer = flags.outline || byDepth ? scene.enableGeometryBufferRenderer() : null;
  if (gbuffer) {
    gbuffer.useSpecificClearForDepthTexture = true;
    gbuffer.renderTransparentMeshes = false;
    gbuffer.getGBuffer().renderListPredicate = inDepthPass;
    const textures = gbuffer.getGBuffer().textures;
    const depth = textures[gbuffer.getTextureIndex(GeometryBufferRenderer.DEPTH_TEXTURE_TYPE)]!;
    const normal = textures[gbuffer.getTextureIndex(GeometryBufferRenderer.NORMAL_TEXTURE_TYPE)]!;
    const heightPx = () => engine.getRenderingCanvas()?.clientHeight ?? engine.getRenderHeight();
    const limits = new Float32Array(MAX_PIXEL_SIZE);
    const bindBlocks = (effect: Effect) => {
      const { width, height } = depth.getSize();
      effect.setTexture("depthSampler", depth);
      effect.setFloat2("size", width, height);
      if (!byDepth) return;
      const base = Math.min(MAX_PIXEL_SIZE, pixelScale(flags, heightPx()));
      limits.fill(1e9);
      limits.set(pixelBands(base, camera.fov));
      effect.setFloat("base", base);
      effect.setFloatArray("limits", limits);
    };
    const blockDefines = byDepth ? ["#define BY_DEPTH", `#define MAX_SIZE ${MAX_PIXEL_SIZE}`] : [];
    if (flags.outline) {
      const outline = new EffectWrapper({
        engine, name: "pixel-outline", fragmentShader: "pixelOutline", useShaderStore: true,
        uniformNames: ["size", "base", "limits", "farPerTexel"], samplerNames: ["depthSampler", "normalSampler"],
        defines: [...blockDefines, gbuffer.normalsAreUnsigned ? "#define UNSIGNED_NORMALS" : "",
          // The shades are on screen, after tone mapping; the scene is drawn linear, before it.
          `#define EDGE_SHADE ${(OUTLINE.edgeShade ** 2.2).toFixed(4)}`,
          `#define CREASE_SHADE ${(OUTLINE.creaseShade ** 2.2).toFixed(4)}`,
          `#define CREASE_AT ${OUTLINE.creaseAt.toFixed(3)}`],
      });
      outline.onApplyObservable.add(() => {
        bindBlocks(outline.effect);
        outline.effect.setTexture("normalSampler", normal);
        outline.effect.setFloat("farPerTexel", OUTLINE.fartherPerPx * renderScale(flags, heightPx()));
      });
      const renderer = new EffectRenderer(engine);
      drawOverOpaque(scene, () => {
        engine.setAlphaMode(Constants.ALPHA_MULTIPLY);
        renderer.render(outline);
        engine.setAlphaMode(Constants.ALPHA_DISABLE);
      });
    }
    sunRays(camera, depth, sky);
    if (byDepth) {
      const pixelate = new PostProcess(
        "pixelate", "pixelate", ["size", "base", "limits"], ["depthSampler"], 1, camera,
        Constants.TEXTURE_NEAREST_SAMPLINGMODE, undefined, false,
        [...blockDefines, flags.aa ? "#define AVERAGE" : ""].join("\n"),
      );
      pixelate.onApply = bindBlocks;
    }
  }
  if (flags.palette) {
    const tones = rampTones();
    const defines = `#define TONES ${tones.length}\n${flags.palette === "bands" ? "#define BANDS" : ""}`;
    const palette = new PostProcess(
      "pixel-palette", "pixelPalette", ["tones"], null, 1, camera,
      Constants.TEXTURE_NEAREST_SAMPLINGMODE, undefined, false, defines,
    );
    const flat = tones.flat();
    palette.onApply = (effect) => effect.setArray3("tones", flat);
  }
}
