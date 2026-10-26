/** Paints the player's sprites (field and arena) in their character's look. */
import type { Look } from "@infinite-tower/shared";
import type { Battle } from "../battle/battle.js";
import type { Field } from "../field/field.js";
import { playerFrames } from "../gfx/characters.js";
import { POSES } from "../gfx/look/battle.js";
import { CHIBI_FACINGS } from "../gfx/look/look.js";
import { redrawSprite } from "../gfx/sprites.js";

export function applyLook(battle: Battle, field: Field, look: Look): void {
  const frames = playerFrames(look);
  const arenaSprites = battle.ctx.materials.player;
  for (const pose of POSES) redrawSprite(arenaSprites[pose], frames.battle[pose]);
  const fieldSprites = field.view.materials.player;
  for (const facing of CHIBI_FACINGS) redrawSprite(fieldSprites[facing], frames.chibi[facing]);
}
