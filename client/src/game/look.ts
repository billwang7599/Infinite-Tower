/** Paints the player's sprites (field and arena) in their character's look. */
import type { Look } from "@infinite-tower/shared";
import type { Battle } from "../battle/battle.js";
import type { Field } from "../field/field.js";
import { playerFrames } from "../gfx/characters.js";
import { redrawSprite } from "../gfx/sprites.js";

export function applyLook(battle: Battle, field: Field, look: Look): void {
  const frames = playerFrames(look);
  const arenaSprites = battle.ctx.materials.player;
  redrawSprite(arenaSprites.idle, frames.idle);
  redrawSprite(arenaSprites.slash, frames.slash);
  redrawSprite(arenaSprites.down, frames.down);
  redrawSprite(field.view.materials.player, frames.field);
}
