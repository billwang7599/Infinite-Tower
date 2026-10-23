/** Paints the player's sprites (field and arena) in their character's look. */
import type { Look } from "@infinite-tower/shared";
import type { Battle } from "../battle/battle.js";
import type { Field } from "../field/field.js";
import { playerFrames } from "../gfx/characters.js";
import { redrawSprite } from "../gfx/sprites.js";

export function dressPlayer(battle: Battle, field: Field, look: Look): void {
  const frames = playerFrames(look);
  const arena = battle.ctx.materials.player;
  redrawSprite(arena.idle, frames.idle);
  redrawSprite(arena.slash, frames.slash);
  redrawSprite(arena.down, frames.down);
  redrawSprite(field.view.materials.player, frames.idle);
}
