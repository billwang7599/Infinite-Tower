import type { EnemyId } from "@infinite-tower/shared";
import type { SpriteDraw } from "../sprites.js";
import type { Visual } from "../visuals.js";
import { goblinVisual } from "./goblin-warlock/animation.js";
import { goblinSprite } from "./goblin-warlock/sprite.js";
import { koboldGreatswordSprite } from "./kobold-greatsword/sprite.js";
import { koboldVisual } from "./kobold-swordsman/animation.js";
import { koboldSprite } from "./kobold-swordsman/sprite.js";
import { boarVisual } from "./wild-boar/animation.js";
import { boarSprite } from "./wild-boar/sprite.js";

/** The overworld's picture: a side view facing right. */
export interface EnemySprite {
  sizeTiles: number;
  draw: SpriteDraw;
}

export interface EnemyLook {
  battle: Visual<any>;
  sprite: EnemySprite;
}

export const ENEMY_LOOKS: Record<EnemyId, EnemyLook> = {
  "wild-boar": { battle: boarVisual, sprite: boarSprite },
  "kobold-swordsman": { battle: koboldVisual, sprite: koboldSprite },
  "kobold-greatsword": { battle: koboldVisual, sprite: koboldGreatswordSprite },
  "goblin-warlock": { battle: goblinVisual, sprite: goblinSprite },
};

export function byEnemy<T>(f: (look: EnemyLook, id: EnemyId) => T): Record<EnemyId, T> {
  const entries = Object.entries(ENEMY_LOOKS).map(([id, look]) => [id, f(look, id as EnemyId)]);
  return Object.fromEntries(entries) as Record<EnemyId, T>;
}
