import { Color3, Constants, Effect, Matrix, PostProcess, Vector3, type Camera, type Texture } from "@babylonjs/core";
import { smoothstep, type Vec3 } from "@infinite-tower/shared";
import type { Sky } from "./sky.js";

/** `reach`: the share of the way to the sun each pixel looks; `facing`: dot(view, sun) where they fade in. */
const RAYS = { strength: 0.6, samples: 24, reach: 0.8, decay: 0.95, facing: [0.1, 0.6] as const };

export function sunOnScreen(toSun: Vec3, viewProjection: Matrix): { u: number; v: number } | null {
  const m = viewProjection.m, { x, y, z } = toSun;
  const w = x * m[3]! + y * m[7]! + z * m[11]!;
  if (w <= 1e-6) return null;
  const u = (x * m[0]! + y * m[4]! + z * m[8]!) / w, v = (x * m[1]! + y * m[5]! + z * m[9]!) / w;
  return { u: u * 0.5 + 0.5, v: v * 0.5 + 0.5 };
}

// The depth pass leaves the sky at 0 (nothing drawn there), so a pixel is lit by the sky between it and the sun.
Effect.ShadersStore["sunRaysFragmentShader"] = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform sampler2D depthSampler;
uniform vec2 sunUV;
uniform vec3 rayColor;
uniform float aspect;
void main(void) {
  vec4 color = texture2D(textureSampler, vUV);
  vec2 delta = (sunUV - vUV) * (REACH / float(SAMPLES));
  vec2 uv = vUV;
  float lit = 0.0, weight = 1.0, total = 0.0;
  for (int i = 0; i < SAMPLES; i++) {
    uv += delta;
    float d = texture2D(depthSampler, clamp(uv, 0.0, 1.0)).r;
    lit += (d <= 0.0 ? 1.0 : 0.0) * weight;
    total += weight;
    weight *= DECAY;
  }
  vec2 off = (vUV - sunUV) * vec2(aspect, 1.0);
  gl_FragColor = vec4(color.rgb + rayColor * (lit / total) / (1.0 + 3.0 * dot(off, off)), color.a);
}`;

export function sunRays(camera: Camera, depth: Texture, sky: Sky): void {
  const defines = [`#define SAMPLES ${RAYS.samples}`, `#define REACH ${RAYS.reach.toFixed(3)}`,
    `#define DECAY ${RAYS.decay.toFixed(3)}`].join("\n");
  const pass = new PostProcess(
    "sun-rays", "sunRays", ["sunUV", "rayColor", "aspect"], ["depthSampler"], 1, camera,
    Constants.TEXTURE_NEAREST_SAMPLINGMODE, undefined, false, defines,
  );
  const forward = new Vector3(), color = new Color3(), viewProjection = new Matrix();
  pass.onApply = (effect) => {
    camera.getViewMatrix().multiplyToRef(camera.getProjectionMatrix(), viewProjection);
    const { toSun } = sky.glow, at = sunOnScreen(toSun, viewProjection);
    camera.getDirectionToRef(Vector3.Forward(), forward);
    const ahead = forward.x * toSun.x + forward.y * toSun.y + forward.z * toSun.z;
    const facing = at ? smoothstep(...RAYS.facing, ahead) : 0;
    sky.glow.color.scaleToRef(RAYS.strength * facing, color);
    effect.setFloat2("sunUV", at?.u ?? 0.5, at?.v ?? 0.5);
    effect.setColor3("rayColor", color);
    effect.setFloat("aspect", pass.width / pass.height);
    effect.setTexture("depthSampler", depth);
  };
}
