/**
 * The game, built once behind the title and joined once per session. Its own lazily loaded chunk: Babylon and the
 * arena's physics are nearly all of the download.
 */
import { Engine } from "@babylonjs/core";
import { World } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import { createBattle } from "../modes/battle/battle.js";
import { createBattleScene } from "../modes/battle/scene.js";
import type { Actions } from "../core/actions.js";
import { createOverworld } from "../modes/overworld/overworld.js";
import { createOverworldScene } from "../modes/overworld/scene.js";
import type { Settings } from "../settings/settings.js";
import type { UiState } from "../ui/state.js";
import { createGame, type Game } from "./game.js";

export async function prepareGame(ui: UiState, settings: Settings, actions: Actions): Promise<Game> {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  // Each mode keeps its own fixed-step clock (the arena's: modes/battle/pace.ts).
  const engine = new Engine(canvas, true);
  window.addEventListener("resize", () => engine.resize());

  // Rapier loads here, behind the title, so a fight never waits for it.
  const physicsLoaded = initPhysics();
  const world = new World();
  const battleScene = createBattleScene(engine);
  const overworldView = createOverworldScene(engine);

  const battle = createBattle({
    engine, world, scene: battleScene, actions, settings, hud: ui.battle,
    onLeave: () => game.leaveBattle(),
  });
  const overworld = createOverworld({ engine, world, view: overworldView, actions, hud: ui.overworld });
  const game = createGame({ engine, actions, ui, settings, battle, overworld });
  await physicsLoaded;
  return game;
}
