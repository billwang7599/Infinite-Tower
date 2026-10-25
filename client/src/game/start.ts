/**
 * The game, built once and joined once per session. main.ts imports this lazily (its own chunk: Babylon and
 * Havok, nearly all of the download) and calls prepareGame() as soon as it arrives, while the title is up:
 * engine, Havok, both scenes and modes, input off. Play connects and join()s; Return to title or a lost
 * connection leave()s, and the next Play joins again with everything still built.
 */
import { Engine } from "@babylonjs/core";
import { FIXED_DT, World } from "@infinite-tower/shared";
import { createBattle } from "../battle/battle.js";
import { createBattleScene } from "../battle/scene.js";
import { Keyboard } from "../core/keyboard.js";
import { Mouse } from "../core/mouse.js";
import { createField } from "../field/field.js";
import { createFieldScene } from "../field/scene.js";
import type { Settings } from "../settings/settings.js";
import type { UiState } from "../ui/state.js";
import { createGame, type Game } from "./game.js";

export async function prepareGame(ui: UiState, settings: Settings): Promise<Game> {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  // Deterministic lockstep: the battle scene steps gameplay + physics at a fixed FIXED_DT (max 4 per frame).
  const engine = new Engine(canvas, true, { deterministicLockstep: true, lockstepMaxSteps: 4, timeStep: FIXED_DT });
  window.addEventListener("resize", () => engine.resize());

  const world = new World();
  const battleScene = await createBattleScene(engine);
  const fieldView = createFieldScene(engine);

  // Input stays off until a session starts (game.ts): the key that pressed Play never reaches the game, and
  // the title keeps the keys Keyboard swallows (Space, arrows).
  const keyboard = new Keyboard();
  const mouse = new Mouse(canvas);
  const battle = createBattle({
    engine, world, scene: battleScene, keyboard, mouse, settings, hud: ui.battle,
    onLeave: () => game.leaveBattle(),
  });
  const field = createField({ engine, world, view: fieldView, keyboard, settings, hud: ui.field });
  const game = createGame({ engine, keyboard, mouse, ui, settings, battle, field });
  return game;
}
