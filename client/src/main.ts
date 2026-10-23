/**
 * Entry point: mounts the React UI, then creates the engine, the shared ECS world, both modes, and hands
 * them to the game.
 *
 *   game/     mode switching + transitions        net/     server connection
 *   field/    the 2D map mode (+ level renderers)  battle/  the 2.5D arena fight mode (Havok)
 *   core/     keyboard, mouse, frame time          gfx/     procedural textures + pixel-art sprites
 *   ui/       React UI over the canvas (HUDs, toasts, fade); the game writes to it through ui/state.ts
 */
import { Engine } from "@babylonjs/core";
import * as shared from "@infinite-tower/shared";
import { createBattle } from "./battle/battle.js";
import * as battleComponents from "./battle/components.js";
import * as playerComponents from "./battle/player/components.js";
import { Keyboard } from "./core/keyboard.js";
import { Mouse } from "./core/mouse.js";
import * as fieldComponents from "./field/components.js";
import { createField } from "./field/field.js";
import { createGame } from "./game/game.js";
import { Connection } from "./net/connection.js";
import { mountUi } from "./ui/mount.js";
import { UiState } from "./ui/state.js";

async function main(ui: UiState): Promise<void> {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  // Deterministic lockstep: the battle scene steps gameplay + physics at a fixed FIXED_DT (max 4 per frame).
  const engine = new Engine(canvas, true, { deterministicLockstep: true, lockstepMaxSteps: 4, timeStep: shared.FIXED_DT });
  window.addEventListener("resize", () => engine.resize());

  // The server owns the field, encounters and enemies; nothing starts until it says hello.
  const { net, welcome } = await Connection.open();
  const world = new shared.World();
  const keyboard = new Keyboard();
  const mouse = new Mouse(canvas);
  const game = createGame(engine, keyboard, mouse, ui, net);

  const battle = await createBattle({ engine, world, keyboard, mouse, hud: ui.battle, onLeave: game.leaveBattle });
  const field = createField({ engine, world, keyboard, hud: ui.field, net, wins: welcome.wins });
  game.run(battle, field);

  // Dev handles for the browser console (and the browser tests): `battle` and `field` hold each mode's
  // world/scene, `components` every component type, `ui` the HUD stores.
  if (import.meta.env.DEV || new URLSearchParams(location.search).has("debug")) {
    Object.assign(window, {
      battle: battle.ctx, field: field.view, mode: game.mode, ui,
      encounter: () => net.send({ t: "debug", cmd: "encounter" }),
      components: { ...shared, ...battleComponents, ...playerComponents, ...fieldComponents },
    });
  }
}

const ui = new UiState();
mountUi(document.getElementById("ui")!, ui);
main(ui).catch((err: unknown) => {
  console.error(err);
  ui.screen.set({ error: err instanceof Error ? err.message : String(err) });
});
