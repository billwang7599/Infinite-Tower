/** Paints the player's sprites (overworld and arena) in their character's look. */
import type { Look } from "@infinite-tower/shared";
import type { Battle } from "../battle/battle.js";
import type { Overworld } from "../overworld/overworld.js";
import { BATTLE_FRAMES, playerFrames } from "../gfx/characters.js";
import type { Pose, SwordPose } from "../gfx/look/battle.js";
import { CHIBI_FACINGS } from "../gfx/look/look.js";
import { redrawSprite } from "../gfx/sprites.js";

export function applyLook(battle: Battle, overworld: Overworld, look: Look): void {
  const frames = playerFrames(look);
  const arenaSprites = battle.ctx.materials.player;
  for (const pose of Object.keys(BATTLE_FRAMES) as (Pose | SwordPose)[]) {
    arenaSprites[pose].forEach((material, i) => redrawSprite(material, frames.battle[pose][i]!));
  }
  const overworldSprites = overworld.view.materials.player;
  for (const facing of CHIBI_FACINGS) redrawSprite(overworldSprites[facing], frames.chibi[facing]);
}
