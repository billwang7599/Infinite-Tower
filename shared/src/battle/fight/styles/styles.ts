import type { Entity, System, World } from "../../../core/ecs.js";
import type { CombatStyle, Weapon } from "../../../weapons/weapons.js";
import type { PlayerData, StaminaData, WielderData } from "../../components.js";
import type { PlayerInputData } from "../../input.js";
import type { Defend } from "../combat.js";
import type { FightEvent } from "../context.js";
import { FOR_HONOR } from "./for-honor.js";
import { hybridDefend } from "./hybrid/defend.js";
import { kickSystem } from "./hybrid/kick.js";
import { HYBRID_PLAYER } from "./hybrid/player.js";
import { hybridSwordsmanSystem } from "./hybrid/swordsman.js";

export interface SwordTurn {
  world: World;
  e: Entity;
  dt: number;
  events: FightEvent[];
  player: PlayerData;
  input: PlayerInputData;
  wielder: WielderData;
  stamina: StaminaData;
  weapon: Weapon | null;
  stunned: boolean;
  free: boolean;
}

export interface Style {
  read(t: SwordTurn): void;
  first(t: SwordTurn): boolean;
  last(t: SwordTurn): boolean;
  defend: Defend;
  swordsman(events: FightEvent[]): System;
  after(events: FightEvent[]): System;
}

export const STYLES: Record<CombatStyle, Style> = {
  "for-honor": FOR_HONOR,
  hybrid: { ...HYBRID_PLAYER, defend: hybridDefend, swordsman: hybridSwordsmanSystem, after: kickSystem },
};
