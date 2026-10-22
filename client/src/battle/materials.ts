/**
 * Arena materials, built from procedural textures so the prototype needs no asset files.
 * Swap these for real art later; nothing else depends on how they're made.
 */
import { Color3, StandardMaterial, type DynamicTexture, type Scene } from "@babylonjs/core";
import { drawPlayerDown, drawPlayerIdle, drawPlayerSlash } from "../gfx/characters.js";
import { spriteMaterial, spriteTexture } from "../gfx/sprites.js";
import { blobTexture, speckleTexture, telegraphTexture } from "../gfx/textures.js";

export interface Materials {
  grass: StandardMaterial;
  dirt: StandardMaterial;
  stone: StandardMaterial;
  bark: StandardMaterial;
  leaves: StandardMaterial;
  shadow: StandardMaterial;
  player: { idle: StandardMaterial; slash: StandardMaterial; down: StandardMaterial };
  slashFx: StandardMaterial;
  telegraph: StandardMaterial;
}

function tiled(scene: Scene, name: string, tex: DynamicTexture, scale: number): StandardMaterial {
  tex.uScale = tex.vScale = scale;
  const m = new StandardMaterial(name, scene);
  m.diffuseTexture = tex;
  m.specularColor = Color3.Black();
  return m;
}

export function createMaterials(scene: Scene): Materials {
  const grass = tiled(scene, "grass",
    speckleTexture(scene, "grass", "#3f6b35", ["#4d7f3e", "#355a2c", "#5b8a45", "#2d4d27"], 900, 5, 1), 18);
  const dirt = tiled(scene, "dirt",
    speckleTexture(scene, "dirt", "#7a6347", ["#8a7253", "#6a553c", "#93806a", "#5a4733"], 900, 4, 2), 6);
  dirt.zOffset = -1;
  const stone = tiled(scene, "stone",
    speckleTexture(scene, "stone", "#7c7f86", ["#8d9097", "#6a6d74", "#5d6067", "#9a9ca2"], 500, 6, 3), 1);
  const bark = new StandardMaterial("bark", scene);
  bark.diffuseColor = new Color3(0.32, 0.22, 0.14);
  bark.specularColor = Color3.Black();
  const leaves = new StandardMaterial("leaves", scene);
  leaves.diffuseColor = new Color3(0.16, 0.36, 0.2);
  leaves.specularColor = Color3.Black();

  const shadow = new StandardMaterial("shadow", scene);
  shadow.diffuseTexture = blobTexture(scene);
  shadow.useAlphaFromDiffuseTexture = true;
  shadow.disableLighting = true;
  shadow.emissiveColor = Color3.Black();
  shadow.zOffset = -2; // avoid z-fighting with the ground

  const slashFx = new StandardMaterial("slash-fx", scene);
  slashFx.disableLighting = true;
  slashFx.emissiveColor = new Color3(1.4, 1.6, 1.9); // > 1 so bloom catches it
  slashFx.alpha = 0.9;
  slashFx.backFaceCulling = false;

  const telegraph = new StandardMaterial("telegraph", scene);
  telegraph.diffuseTexture = telegraphTexture(scene);
  telegraph.useAlphaFromDiffuseTexture = true;
  telegraph.emissiveColor = new Color3(1, 0.3, 0.15);
  telegraph.disableLighting = true;
  telegraph.zOffset = -3;

  return {
    grass, dirt, stone, bark, leaves, shadow,
    player: {
      idle: spriteMaterial(scene, "player-idle", spriteTexture(scene, "player-idle", drawPlayerIdle)),
      slash: spriteMaterial(scene, "player-slash", spriteTexture(scene, "player-slash", drawPlayerSlash)),
      down: spriteMaterial(scene, "player-down", spriteTexture(scene, "player-down", drawPlayerDown)),
    },
    slashFx, telegraph,
  };
}
