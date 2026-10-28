import { Color3, StandardMaterial, type Scene } from "@babylonjs/core";

/** A plain material of one color, not shiny unless `specular` says so (tree bark, leaves, the boar's hide). */
export function colorMaterial(scene: Scene, name: string, color: Color3, specular = Color3.Black()): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color;
  m.specularColor = specular;
  return m;
}
