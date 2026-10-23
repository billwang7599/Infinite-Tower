/**
 * Builds and starts the game once the server has said hello: engine, ECS world, input, both modes.
 * main.ts imports this lazily, so Babylon and Havok (nearly all of the download) stay out of the first
 * chunk and load while the title screen is up.
 */
import { Engine } from "@babylonjs/core";
import * as shared from "@infinite-tower/shared";
import { createBattle } from "../battle/battle.js";
import * as battleComponents from "../battle/components.js";
import * as playerComponents from "../battle/player/components.js";
import { Keyboard } from "../core/keyboard.js";
import { Mouse } from "../core/mouse.js";
import * as fieldComponents from "../field/components.js";
import { createField } from "../field/field.js";
import type { Joined } from "../net/connection.js";
import type { UiState } from "../ui/state.js";
import { createGame } from "./game.js";

export async function startGame(ui: UiState, { net, welcome }: Joined): Promise<void> {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  // Deterministic lockstep: the battle scene steps gameplay + physics at a fixed FIXED_DT (max 4 per frame).
  const engine = new Engine(canvas, true, { deterministicLockstep: true, lockstepMaxSteps: 4, timeStep: shared.FIXED_DT });
  window.addEventListener("resize", () => engine.resize());

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
