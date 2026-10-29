/** Arena materials, from procedural textures: no asset files. */
import { Color3, StandardMaterial, type Scene } from "@babylonjs/core";
import { BATTLE_FACINGS, type BattleFacing } from "../../gfx/look/art.js";
import type { Pose, SwordPose } from "../../gfx/look/battle.js";
import { BATTLE_FRAMES } from "../characters.js";
import { spriteMaterial } from "../sprites.js";
import { blobTexture, telegraphTexture } from "../textures.js";

export type PlayerFrames = Record<BattleFacing, Record<Pose | SwordPose, StandardMaterial[]>>;

export interface Materials {
  /** The soft round shadow under the player's sprite. */
  blobShadow: StandardMaterial;
  player: PlayerFrames;
  slashFx: StandardMaterial;
  /** The block's guard in front of the player. */
  guardFx: StandardMaterial;
  telegraph: StandardMaterial;
}

export function createMaterials(scene: Scene): Materials {
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

  const guardFx = new StandardMaterial("guard-fx", scene);
  guardFx.disableLighting = true;
  guardFx.emissiveColor = new Color3(0.6, 0.8, 1.2);
  guardFx.alpha = 0.3;
  guardFx.backFaceCulling = false;

  const telegraph = new StandardMaterial("telegraph", scene);
  telegraph.diffuseTexture = telegraphTexture(scene);
  telegraph.useAlphaFromDiffuseTexture = true;
  telegraph.emissiveColor = new Color3(1, 0.3, 0.15);
  telegraph.disableLighting = true;
  telegraph.zOffset = -3;

  return { blobShadow, player: playerFrames(scene, "player"), slashFx, guardFx, telegraph };
}

export function playerFrames(scene: Scene, who: string): PlayerFrames {
  const all = {} as PlayerFrames;
  for (const facing of BATTLE_FACINGS) {
    const poses = all[facing] = {} as PlayerFrames[BattleFacing];
    for (const [pose, count] of Object.entries(BATTLE_FRAMES) as [Pose | SwordPose, number][]) {
      poses[pose] = Array.from({ length: count }, (_, i) =>
        spriteMaterial(scene, `${who}-${facing}-${pose}-${i}`, () => {}));
    }
  }
  return all;
}
