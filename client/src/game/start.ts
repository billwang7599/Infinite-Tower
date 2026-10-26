/**
 * The game, built once and joined once per session. main.ts imports this lazily (its own chunk: Babylon and
 * the arena's physics, nearly all of the download) and calls prepareGame() as soon as it arrives, while the title is
 * up: engine, physics, both scenes and modes, input off. Play connects and join()s; Return to title or a lost
 * connection leave()s, and the next Play joins again with everything still built.
 */
import { Engine } from "@babylonjs/core";
import { FIXED_DT, World } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { createBattle } from "../battle/battle.js";
import { createBattleScene } from "../battle/scene.js";
import { Keyboard } from "../core/keyboard.js";
import { Mouse } from "../core/mouse.js";
import { createOverworld } from "../overworld/overworld.js";
import { createOverworldScene } from "../overworld/scene.js";
import type { Settings } from "../settings/settings.js";
import type { UiState } from "../ui/state.js";
import { createGame, type Game } from "./game.js";

export async function prepareGame(ui: UiState, settings: Settings): Promise<Game> {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  // Deterministic lockstep: the battle scene steps the fight at a fixed FIXED_DT (max 4 per frame).
  const engine = new Engine(canvas, true, { deterministicLockstep: true, lockstepMaxSteps: 4, timeStep: FIXED_DT });
  window.addEventListener("resize", () => engine.resize());

  // Rapier loads here, behind the title, so a fight never waits for it.
  const physicsLoaded = initPhysics();
  const world = new World();
  const battleScene = createBattleScene(engine);
  const overworldView = createOverworldScene(engine);

  // Input stays off until a session starts (game.ts): the key that pressed Play never reaches the game, and
  // the title keeps the keys Keyboard swallows (Space, arrows).
  const keyboard = new Keyboard();
  const mouse = new Mouse(canvas);
  const battle = createBattle({
    engine, world, scene: battleScene, keyboard, mouse, settings, hud: ui.battle,
    onLeave: () => game.leaveBattle(),
  });
  const overworld = createOverworld({ engine, world, view: overworldView, keyboard, settings, hud: ui.overworld });
  const game = createGame({ engine, keyboard, mouse, ui, settings, battle, overworld });
  await physicsLoaded;
  return game;
}
