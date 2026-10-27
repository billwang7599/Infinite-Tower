/**
 * The game, built once behind the title and joined once per session. Its own lazily loaded chunk: Babylon and the
 * arena's physics are nearly all of the download.
 */
import { Engine } from "@babylonjs/core";
import { World } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { createBattle } from "../battle/battle.js";
import { createBattleScene } from "../battle/scene.js";
import { Actions } from "../core/actions.js";
import { Keyboard } from "../core/keyboard.js";
import { Mouse } from "../core/mouse.js";
import { createOverworld } from "../overworld/overworld.js";
import { createOverworldScene } from "../overworld/scene.js";
import type { Settings } from "../settings/settings.js";
import type { UiState } from "../ui/state.js";
import { createGame, type Game } from "./game.js";

export async function prepareGame(ui: UiState, settings: Settings): Promise<Game> {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  // Each mode keeps its own fixed-step clock (the arena's: battle/pace.ts).
  const engine = new Engine(canvas, true);
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
  const actions = new Actions(keyboard, mouse, settings.bindings);
  const battle = createBattle({
    engine, world, scene: battleScene, keyboard, mouse, actions, settings, hud: ui.battle,
    onLeave: () => game.leaveBattle(),
  });
  const overworld = createOverworld({ engine, world, view: overworldView, actions, hud: ui.overworld });
  const game = createGame({ engine, keyboard, mouse, ui, settings, battle, overworld });
  await physicsLoaded;
  return game;
}
