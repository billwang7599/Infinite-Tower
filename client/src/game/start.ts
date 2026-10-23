/**
 * The game, in two steps. main.ts imports this lazily (its own chunk: Babylon and Havok, nearly all of the
 * download) and calls prepareGame() as soon as it arrives, while the title is up: engine, Havok and both
 * scenes, nothing drawn yet. Play connects, then join() adds the server and input and starts the render loop.
 */
import { Engine } from "@babylonjs/core";
import * as shared from "@infinite-tower/shared";
import { createBattle } from "../battle/battle.js";
import * as battleComponents from "../battle/components.js";
import * as playerComponents from "../battle/player/components.js";
import { createBattleScene } from "../battle/scene.js";
import { Keyboard } from "../core/keyboard.js";
import { Mouse } from "../core/mouse.js";
import * as fieldComponents from "../field/components.js";
import { createField } from "../field/field.js";
import { createFieldScene } from "../field/scene.js";
import type { Joined } from "../net/connection.js";
import type { UiState } from "../ui/state.js";
import { createGame } from "./game.js";

export interface PreparedGame {
  join(ui: UiState, joined: Joined): void;
}

export async function prepareGame(): Promise<PreparedGame> {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  // Deterministic lockstep: the battle scene steps gameplay + physics at a fixed FIXED_DT (max 4 per frame).
  const engine = new Engine(canvas, true, { deterministicLockstep: true, lockstepMaxSteps: 4, timeStep: shared.FIXED_DT });
  window.addEventListener("resize", () => engine.resize());

  const world = new shared.World();
  const battleScene = await createBattleScene(engine);
  const fieldView = createFieldScene(engine);

  return {
    join(ui, { net, welcome }) {
      // Input only starts listening now: the key that pressed Play never reaches the game, and the title
      // keeps the keys Keyboard swallows (Space, arrows).
      const keyboard = new Keyboard();
      const mouse = new Mouse(canvas);
      const game = createGame(engine, keyboard, mouse, ui, net);

      const battle = createBattle({
        engine, world, scene: battleScene, keyboard, mouse, hud: ui.battle, onLeave: game.leaveBattle,
      });
      const field = createField({ engine, world, view: fieldView, keyboard, hud: ui.field, net, wins: welcome.wins });
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
    },
  };
}
