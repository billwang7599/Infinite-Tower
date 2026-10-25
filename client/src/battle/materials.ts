/**
 * Arena materials, built from procedural textures so the prototype needs no asset files.
 * Swap these for real art later; nothing else depends on how they're made.
 */
import { Color3, StandardMaterial, type DynamicTexture, type Scene } from "@babylonjs/core";
import { DEFAULT_LOOK } from "@infinite-tower/shared";
import { playerFrames } from "../gfx/characters.js";
import { colorMaterial } from "../gfx/materials.js";
import { spriteMaterial } from "../gfx/sprites.js";
import { blobTexture, speckleTexture, telegraphTexture } from "../gfx/textures.js";

export interface Materials {
  grass: StandardMaterial;
  dirt: StandardMaterial;
  stone: StandardMaterial;
  bark: StandardMaterial;
  leaves: StandardMaterial;
  /** The soft round shadow under the player's sprite. */
  blobShadow: StandardMaterial;
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

/** The player is drawn in the default look until `welcome` says who they are (game/look.ts repaints it). */
export function createMaterials(scene: Scene): Materials {
  const frames = playerFrames(DEFAULT_LOOK);
  const grass = tiled(scene, "grass", speckleTexture(scene, "grass", {
    base: "#3f6b35", specks: ["#4d7f3e", "#355a2c", "#5b8a45", "#2d4d27"], count: 900, maxRadiusPx: 5, seed: 1,
  }), 18);
  const dirt = tiled(scene, "dirt", speckleTexture(scene, "dirt", {
    base: "#7a6347", specks: ["#8a7253", "#6a553c", "#93806a", "#5a4733"], count: 900, maxRadiusPx: 4, seed: 2,
  }), 6);
  dirt.zOffset = -1;
  const stone = tiled(scene, "stone", speckleTexture(scene, "stone", {
    base: "#7c7f86", specks: ["#8d9097", "#6a6d74", "#5d6067", "#9a9ca2"], count: 500, maxRadiusPx: 6, seed: 3,
  }), 1);
  const bark = colorMaterial(scene, "bark", new Color3(0.32, 0.22, 0.14));
  const leaves = colorMaterial(scene, "leaves", new Color3(0.16, 0.36, 0.2));

  const blobShadow = new StandardMaterial("shadow", scene);
  blobShadow.diffuseTexture = blobTexture(scene);
  blobShadow.useAlphaFromDiffuseTexture = true;
  blobShadow.disableLighting = true;
  blobShadow.emissiveColor = Color3.Black();
  blobShadow.zOffset = -2; // avoid z-fighting with the ground

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
    grass, dirt, stone, bark, leaves, blobShadow,
    player: {
      idle: spriteMaterial(scene, "player-idle", frames.idle),
      slash: spriteMaterial(scene, "player-slash", frames.slash),
      down: spriteMaterial(scene, "player-down", frames.down),
    },
    slashFx, telegraph,
  };
}
