import {
  MaterialPluginBase, ShaderLanguage, type StandardMaterial, type UniformBuffer,
} from "@babylonjs/core";
import { PX_PER_TILE } from "../../gfx/grid.js";
import type { PropKind } from "./scenery.js";

interface Sway { tipPx: number; ratePerSec: number }

export const SWAY: Partial<Record<PropKind, Sway>> = {
  tallGrass: { tipPx: 1.5, ratePerSec: 1.6 },
  tuft: { tipPx: 1, ratePerSec: 1.9 },
  reeds: { tipPx: 2, ratePerSec: 1.3 },
  flowers: { tipPx: 1, ratePerSec: 1.7 },
  bush: { tipPx: 0.6, ratePerSec: 1.1 },
  tree: { tipPx: 1, ratePerSec: 0.7 },
  pine: { tipPx: 0.8, ratePerSec: 0.6 },
};

const LOOP_SEC = 3600;
const UNIFORMS = "uniform float swayTime;\nuniform vec4 swayLook;";

// swayLook: picture height (tiles), tip travel (tiles), rate. The phase comes from where each plant stands, so a field
// ripples instead of nodding together; it leans along the picture's own width, which faces the camera.
const VERTEX = {
  CUSTOM_VERTEX_UPDATE_WORLDPOS: `{
  vec2 swayAt = finalWorld[3].xz;
  float swayPhase = swayTime * swayLook.z + dot(swayAt, vec2(0.35, 0.21));
  float swayBy = sin(swayPhase) + 0.4 * sin(swayPhase * 2.3 + swayAt.x);
  worldPos.xyz += normalize(finalWorld[0].xyz) * swayBy * swayLook.y * clamp(position.y / swayLook.x, 0.0, 1.0);
}`,
};

class SwayPlugin extends MaterialPluginBase {
  constructor(material: StandardMaterial, private readonly heightTiles: number, private readonly sway: Sway) {
    super(material, "Sway", 200, undefined, true, true);
  }

  override getClassName(): string {
    return "SwayPlugin";
  }

  override isCompatible(language: ShaderLanguage): boolean {
    return language === ShaderLanguage.GLSL;
  }

  override getUniforms() {
    return {
      ubo: [{ name: "swayTime", size: 1, type: "float" }, { name: "swayLook", size: 4, type: "vec4" }],
      vertex: UNIFORMS,
    };
  }

  override bindForSubMesh(ubo: UniformBuffer): void {
    ubo.updateFloat("swayTime", (performance.now() / 1000) % LOOP_SEC);
    ubo.updateFloat4("swayLook", this.heightTiles, this.sway.tipPx / PX_PER_TILE, this.sway.ratePerSec, 0);
  }

  override getCustomCode(shaderType: string): Record<string, string> | null {
    return shaderType === "vertex" ? VERTEX : null;
  }
}

export function swayIn(material: StandardMaterial, kind: PropKind, heightTiles: number): void {
  const sway = SWAY[kind];
  if (sway) new SwayPlugin(material, heightTiles, sway);
}
