import type { EnemyId, NpcId } from "@infinite-tower/shared";
import { personEnemyVisual } from "../battle/player.js";
import type { SpriteDraw } from "../sprites.js";
import type { Visual } from "../visuals.js";
import { lurkerVisual } from "./bog-lurker/animation.js";
import { lurkerSprite } from "./bog-lurker/sprite.js";
import { bramSprite } from "./bram/sprite.js";
import { goblinVisual } from "./goblin-warlock/animation.js";
import { goblinSprite } from "./goblin-warlock/sprite.js";
import { wolfVisual } from "./grey-wolf/animation.js";
import { wolfSprite } from "./grey-wolf/sprite.js";
import { koboldGreatswordVisual } from "./kobold-greatsword/animation.js";
import { koboldGreatswordSprite } from "./kobold-greatsword/sprite.js";
import { koboldShieldbearerVisual } from "./kobold-shieldbearer/animation.js";
import { koboldShieldbearerSprite } from "./kobold-shieldbearer/sprite.js";
import { koboldSwordsmanVisual } from "./kobold-swordsman/animation.js";
import { koboldSprite } from "./kobold-swordsman/sprite.js";
import { trainingDummyVisual } from "./training-dummy/animation.js";
import { trainingDummySprite } from "./training-dummy/sprite.js";
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
  npc?: NpcId;
}

export const ENEMY_LOOKS: Record<EnemyId, EnemyLook> = {
  "wild-boar": { battle: boarVisual, sprite: boarSprite },
  "kobold-swordsman": { battle: koboldSwordsmanVisual, sprite: koboldSprite },
  "kobold-greatsword": { battle: koboldGreatswordVisual, sprite: koboldGreatswordSprite },
  "kobold-shieldbearer": { battle: koboldShieldbearerVisual, sprite: koboldShieldbearerSprite },
  "goblin-warlock": { battle: goblinVisual, sprite: goblinSprite },
  "grey-wolf": { battle: wolfVisual, sprite: wolfSprite },
  "bog-lurker": { battle: lurkerVisual, sprite: lurkerSprite },
  "training-dummy": { battle: trainingDummyVisual, sprite: trainingDummySprite },
  bram: { battle: personEnemyVisual, sprite: bramSprite, npc: "bram" },
};

export function byEnemy<T>(f: (look: EnemyLook, id: EnemyId) => T): Record<EnemyId, T> {
  const entries = Object.entries(ENEMY_LOOKS).map(([id, look]) => [id, f(look, id as EnemyId)]);
  return Object.fromEntries(entries) as Record<EnemyId, T>;
}
