/**
 * Entry point: the title screen first; Play connects to the server, then this builds the engine, the shared
 * ECS world and both modes, and hands them to the game.
 *
 *   game/     mode switching + transitions        net/     server connection
 *   field/    the 2D map mode (+ level renderers)  battle/  the 2.5D arena fight mode (Havok)
 *   core/     keyboard, mouse, frame time          gfx/     procedural textures + pixel-art sprites
 *   ui/       DOM overlays, menus, screens (title) + Tailwind styles
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
import { createOverlay } from "./ui/overlay.js";
import { openTitleScreen } from "./ui/screens/title.js";
import "./ui/styles.css";

async function main(): Promise<void> {
  const title = openTitleScreen();
  try {
    // The server owns the field, encounters and enemies; nothing starts until it says hello.
    const { net, welcome } = await title.play(() => Connection.open());
    title.status("Loading…");

    const canvas = document.getElementById("game") as HTMLCanvasElement;
    // Deterministic lockstep: the battle scene steps gameplay + physics at a fixed FIXED_DT (max 4 per frame).
    const engine = new Engine(canvas, true, { deterministicLockstep: true, lockstepMaxSteps: 4, timeStep: shared.FIXED_DT });
    window.addEventListener("resize", () => engine.resize());

    const world = new shared.World();
    const keyboard = new Keyboard();
    const mouse = new Mouse(canvas);
    const overlay = createOverlay();
    const game = createGame(engine, keyboard, mouse, overlay, net);

    const battle = await createBattle({ engine, world, keyboard, mouse, hud: overlay.battleHud, onLeave: game.leaveBattle });
    const field = createField({ engine, world, keyboard, hud: overlay.fieldHud, net, wins: welcome.wins });
    game.run(battle, field);
    title.close();

    // Dev handles for the browser console (and the browser tests): `battle` and `field` hold each mode's
    // world/scene, `components` every component type.
    if (import.meta.env.DEV || new URLSearchParams(location.search).has("debug")) {
      Object.assign(window, {
        battle: battle.ctx, field: field.view, mode: game.mode,
        encounter: () => net.send({ t: "debug", cmd: "encounter" }),
        components: { ...shared, ...battleComponents, ...playerComponents, ...fieldComponents },
      });
    }
  } catch (err) {
    console.error(err);
    title.status(`${err instanceof Error ? err.message : String(err)} Reload the page to try again.`, "error");
  }
}

void main();
