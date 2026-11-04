import { Constants, Effect, MeshBuilder, ShaderMaterial, Vector3, type Color3, type Scene } from "@babylonjs/core";
import type { Vec3 } from "@infinite-tower/shared";

export interface DomeColors { horizon: Color3; zenith: Color3; toSun: Vec3; glow: Color3; night: number }

// Inside the overworld camera's far plane (120 m); the shader puts it at the far plane anyway.
const RADIUS_M = 100;

Effect.ShadersStore["skyDomeVertexShader"] = `
precision highp float;
attribute vec3 position;
uniform mat4 world;
uniform mat4 viewProjection;
varying vec3 vDir;
void main(void) {
  vDir = position;
  gl_Position = (viewProjection * world * vec4(position, 1.0)).xyww;
}`;

// Below the horizon it's the fog's colour, so the far fogged ground meets it with no seam. The haze lives here alone.
Effect.ShadersStore["skyDomeFragmentShader"] = `
precision highp float;
varying vec3 vDir;
uniform vec3 horizon;
uniform vec3 zenith;
uniform vec3 toSun;
uniform vec3 glow;
uniform float night;
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
void main(void) {
  vec3 d = normalize(vDir);
  float up = clamp(d.y, 0.0, 1.0);
  vec3 c = mix(horizon, zenith, sqrt(up));
  float s = max(dot(d, toSun), 0.0);
  float haze = (0.05 + 0.5 * s * s * s) * (1.0 - up) * (1.0 - up);
  c += glow * (haze + 0.3 * s * s * s + 0.4 * pow(s, 64.0) + 0.8 * pow(s, 1500.0)) * smoothstep(0.0, 0.04, d.y);
  float star = step(0.9975, hash(floor(d * 220.0))) * hash(floor(d * 220.0) + 7.0);
  c += vec3(0.9, 0.95, 1.1) * star * night * smoothstep(0.05, 0.3, d.y);
  gl_FragColor = vec4(c, 1.0);
}`;

export function createDome(scene: Scene): (colors: DomeColors) => void {
  const dome = MeshBuilder.CreateSphere("sky-dome", { diameter: RADIUS_M * 2, segments: 16 }, scene);
  const m = new ShaderMaterial("sky-dome", scene, "skyDome", {
    attributes: ["position"], uniforms: ["world", "viewProjection", "horizon", "zenith", "toSun", "glow", "night"],
  });
  m.backFaceCulling = false;
  m.disableDepthWrite = true;
  m.depthFunction = Constants.LEQUAL;
  dome.material = m;
  dome.infiniteDistance = true;
  dome.isPickable = false;
  const sun = new Vector3();
  return ({ horizon, zenith, toSun, glow, night }) => {
    m.setColor3("horizon", horizon);
    m.setColor3("zenith", zenith);
    m.setVector3("toSun", sun.set(toSun.x, toSun.y, toSun.z));
    m.setColor3("glow", glow);
    m.setFloat("night", night);
  };
}
