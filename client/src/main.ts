/**
 * Entry point: creates the engine, the shared ECS world, both modes, and hands them to the game.
 *
 *   core/       input devices          gfx/        procedural textures + pixel sprites
 *   battle/     2.5D arena (Havok)     overworld/  2D field
 *   game/       mode switching         ui/         DOM overlays + CSS
 */
import { Engine } from "@babylonjs/core";
import * as shared from "@infinite-tower/shared";
import { createBattle } from "./battle/battle.js";
import * as battleComponents from "./battle/components.js";
import { Keyboard, Mouse } from "./core/input.js";
import { createGame } from "./game/game.js";
import { createOverworld } from "./overworld/overworld.js";
import { createOverlay } from "./ui/overlay.js";

async function main(): Promise<void> {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  // Deterministic lockstep: the battle scene steps gameplay + physics at a fixed FIXED_DT (max 4 per frame).
  const engine = new Engine(canvas, true, { deterministicLockstep: true, lockstepMaxSteps: 4, timeStep: shared.FIXED_DT });
  window.addEventListener("resize", () => engine.resize());

  const world = new shared.World();
  const keyboard = new Keyboard();
  const mouse = new Mouse(canvas);
  const overlay = createOverlay();
  const game = createGame(engine, keyboard, mouse, overlay);

  const battle = await createBattle({ engine, world, keyboard, mouse, hud: overlay.battleHud, onLeave: game.leaveBattle });
  const overworld = createOverworld({ engine, world, keyboard, hud: overlay.mapHud, onEncounter: game.encounter });
  game.run(battle, overworld);

  // Dev handle: inspect from the browser console.
  if (import.meta.env.DEV || new URLSearchParams(location.search).has("debug")) {
    Object.assign(window, { game: battle.ctx, map: overworld.view, mode: game.mode, encounter: game.encounter, components: { ...shared, ...battleComponents } });
  }
}

main().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML("beforeend", `<pre style="color:#f88;padding:16px">${String(err)}</pre>`);
});
