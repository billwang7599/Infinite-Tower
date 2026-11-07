import {
  Constants, Effect, GeometryBufferRenderer, PostProcess, type AbstractMesh, type Camera, type Scene,
} from "@babylonjs/core";
import { ACCENTS, DYES, EYES, FIXED, HAIR, SKIN, type Ramp } from "../../gfx/look/palette.js";

export interface PixelFlags {
  scale: number | "auto" | null;
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

export function pixelFlags(search: string): PixelFlags {
  const params = new URLSearchParams(search);
  const pixel = params.get("pixel"), n = Math.round(Number(pixel));
  const palette = params.get("palette"), steps = Math.round(Number(params.get("steps")));
  return {
    scale: pixel === null ? DEFAULT_PIXEL_SCALE : pixel === "" || pixel === "auto" ? "auto" : n >= 2 ? n : null,
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

export function rampTones(): [number, number, number][] {
  const ramps: Ramp[] = [SKIN, HAIR, EYES, DYES, ACCENTS, FIXED].flatMap((group) => Object.values(group));
  const hexes = [...new Set(ramps.flat())];
  return hexes.map((hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]);
}

Effect.ShadersStore["pixelOutlineFragmentShader"] = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform sampler2D depthSampler;
uniform sampler2D normalSampler;
uniform vec2 texelSize;
vec3 decode(vec3 n) {
#ifdef UNSIGNED_NORMALS
  return n * 2.0 - 1.0;
#else
  return n;
#endif
}
void main(void) {
  vec4 color = texture2D(textureSampler, vUV);
  float depth = texture2D(depthSampler, vUV).r;
  vec3 normal = decode(texture2D(normalSampler, vUV).xyz);
  float farther = 0.0, crease = 0.0;
  vec2 around[4];
  around[0] = vec2(1.0, 0.0); around[1] = vec2(-1.0, 0.0); around[2] = vec2(0.0, 1.0); around[3] = vec2(0.0, -1.0);
  for (int i = 0; i < 4; i++) {
    vec2 uv = vUV + around[i] * texelSize;
    float d = texture2D(depthSampler, uv).r;
    farther = max(farther, d - depth);
    // Only the nearer side of a crease darkens, so it stays one pixel wide.
    if (d > depth - 0.05 * depth) crease = max(crease, 1.0 - dot(normal, decode(texture2D(normalSampler, uv).xyz)));
  }
  float shade = farther > 0.08 * depth ? 0.3 : crease > 0.35 ? 0.65 : 1.0;
  gl_FragColor = vec4(color.rgb * shade, color.a);
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

const sharp = new WeakSet<AbstractMesh>();

/** Left out of the outline: a thin blade or its trail, a pixel or two wide, would be all outline. */
export function keepSharp(mesh: AbstractMesh): void {
  sharp.add(mesh);
}

export function pixelPost(scene: Scene, camera: Camera, flags: PixelFlags): void {
  if (flags.outline) {
    const gbuffer = scene.enableGeometryBufferRenderer();
    if (gbuffer) {
      gbuffer.useSpecificClearForDepthTexture = true;
      gbuffer.getGBuffer().renderListPredicate = (mesh) => !sharp.has(mesh);
      const textures = gbuffer.getGBuffer().textures;
      const depth = textures[gbuffer.getTextureIndex(GeometryBufferRenderer.DEPTH_TEXTURE_TYPE)];
      const normal = textures[gbuffer.getTextureIndex(GeometryBufferRenderer.NORMAL_TEXTURE_TYPE)];
      const outline = new PostProcess(
        "pixel-outline", "pixelOutline", ["texelSize"], ["depthSampler", "normalSampler"], 1, camera,
        Constants.TEXTURE_NEAREST_SAMPLINGMODE, undefined, false,
        gbuffer.normalsAreUnsigned ? "#define UNSIGNED_NORMALS" : "",
      );
      outline.onApply = (effect) => {
        effect.setFloat2("texelSize", 1 / outline.width, 1 / outline.height);
        effect.setTexture("depthSampler", depth!);
        effect.setTexture("normalSampler", normal!);
      };
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
