/**
 * The game, built once behind the title and joined once per session. Its own lazily loaded chunk: Babylon and the
 * arena's physics are nearly all of the download.
 */
import { World } from "@infinite-tower/shared";
import { initPhysics } from "@infinite-tower/shared/fight";
import type { Actions } from "../core/actions.js";
import { createBattle } from "../modes/battle/battle.js";
import { createOverworld } from "../modes/overworld/overworld.js";
import type { Settings } from "../settings/settings.js";
import type { UiState } from "../ui/state.js";
import { createDrawing } from "../visuals/visuals.js";
import { createGame, type Game } from "./game.js";

export async function prepareGame(ui: UiState, settings: Settings, actions: Actions): Promise<Game> {
  // Rapier loads here, behind the title, so a fight never waits for it.
  const physicsLoaded = initPhysics();
  const battle = createBattle({
    actions, settings, hud: ui.battle, skills: ui.skills, chant: ui.chant, bag: ui.battleBag,
    onLeave: () => game.leaveBattle(),
  });
  const overworld = createOverworld({ world: new World(), actions, hud: ui.overworld, camera: settings.camera });
  const drawing = createDrawing(document.getElementById("game") as HTMLCanvasElement, {
    look: () => ui.overworld.get().character?.look ?? null,
    battle: battle.ctx,
    overworld: overworld.state,
  });
  const game = createGame({ drawing, actions, ui, settings, battle, overworld });
  await physicsLoaded;
  return game;
}
