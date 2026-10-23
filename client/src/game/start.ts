/**
 * The game, built once and joined once per session. main.ts imports this lazily (its own chunk: Babylon and
 * Havok, nearly all of the download) and calls prepareGame() as soon as it arrives, while the title is up:
 * engine, Havok, both scenes and modes, input off. Play connects and join()s; Return to title or a lost
 * connection leave()s, and the next Play joins again with everything still built.
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
import type { KeyBindings } from "../settings/bindings.js";
import type { CameraSettings } from "../settings/camera.js";
import type { UiState } from "../ui/state.js";
import { createGame } from "./game.js";

export interface PreparedGame {
  join(joined: Joined, onLost: () => void): void;
  leave(): void;
}

export async function prepareGame(ui: UiState, bindings: KeyBindings, cameraSettings: CameraSettings): Promise<PreparedGame> {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  // Deterministic lockstep: the battle scene steps gameplay + physics at a fixed FIXED_DT (max 4 per frame).
  const engine = new Engine(canvas, true, { deterministicLockstep: true, lockstepMaxSteps: 4, timeStep: shared.FIXED_DT });
  window.addEventListener("resize", () => engine.resize());

  const world = new shared.World();
  const battleScene = await createBattleScene(engine);
  const fieldView = createFieldScene(engine);

  // Input stays off until a session starts (game.ts): the key that pressed Play never reaches the game, and
  // the title keeps the keys Keyboard swallows (Space, arrows).
  const keyboard = new Keyboard();
  const mouse = new Mouse(canvas);
  const game = createGame(engine, keyboard, mouse, ui);
  const battle = createBattle({
    engine, world, scene: battleScene, keyboard, mouse, bindings, cameraSettings, hud: ui.battle, onLeave: game.leaveBattle,
  });
  const field = createField({ engine, world, view: fieldView, keyboard, bindings, hud: ui.field });
  game.setModes(battle, field);

  return {
    join(joined, onLost) {
      game.join(joined, onLost);
      // Dev handles for the browser console (and the browser tests): `battle` and `field` hold each mode's
      // world/scene, `components` every component type, `ui` the HUD stores, `bindings` / `cameraSettings` the settings.
      if (import.meta.env.DEV || new URLSearchParams(location.search).has("debug")) {
        Object.assign(window, {
          battle: battle.ctx, field: field.view, mode: game.mode, ui, bindings, cameraSettings,
          encounter: () => joined.net.send({ t: "debug", cmd: "encounter" }),
          components: { ...shared, ...battleComponents, ...playerComponents, ...fieldComponents },
        });
      }
    },
    leave: () => game.leave(),
  };
}
