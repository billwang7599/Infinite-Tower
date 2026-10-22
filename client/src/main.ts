import { Engine, HavokPlugin, Scene, UniversalCamera, Vector3 } from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";
import havokWasmUrl from "@babylonjs/havok/lib/esm/HavokPhysics.wasm?url";
import {
  World, GRAVITY, FIXED_DT, Player, LocalPlayer, Boar, Health, Stamina, Fighter, ActiveHit, type System,
} from "@infinite-tower/shared";
import { Body, BoarView, SpriteView, registerDisposers } from "./components.js";
import type { GameContext } from "./context.js";
import { Keyboard, Mouse } from "./input.js";
import { createMaterials } from "./materials.js";
import { setupLook } from "./scene.js";
import { buildArena } from "./arena.js";
import { spawnBoar, spawnPlayer } from "./spawn.js";
import { inputSystem } from "./systems/input.js";
import { playerSystem } from "./systems/player.js";
import { boarSystem } from "./systems/boar.js";
import { groundSystem } from "./systems/ground.js";
import { combatSystem } from "./systems/combat.js";
import { spriteSystem } from "./systems/sprite.js";
import { boarViewSystem } from "./systems/boarView.js";
import { cameraSystem } from "./systems/camera.js";
import { hudSystem } from "./systems/hud.js";

/** (Re)start the fight: remove all fighters, spawn the player and the boar facing each other. */
function startFight(ctx: GameContext): void {
  const { world } = ctx;
  for (const [e] of world.query(Fighter)) world.destroy(e);
  world.flush();
  spawnPlayer(ctx, "you", { x: 0, y: 0.05, z: -8 }, true);
  spawnBoar(ctx, { x: 0, y: 0.05, z: 6 }, Math.PI);
  ctx.view.yaw = 0;
  ctx.view.pitch = 0.32;
  ctx.fight.state = "fighting";
  ctx.fight.time = 0;
  ctx.keyboard.clearPressed();
}

async function main(): Promise<void> {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const hud = document.getElementById("hud")!;

  // Deterministic lockstep: Babylon runs scene.onBeforeStep / physics / onAfterStep at a fixed
  // FIXED_DT, as many times per frame as needed (max 4). Rendering runs once per frame.
  const engine = new Engine(canvas, true, {
    deterministicLockstep: true,
    lockstepMaxSteps: 4,
    timeStep: FIXED_DT,
  });
  const scene = new Scene(engine);

  const havok = new HavokPlugin(true, await HavokPhysics({ locateFile: () => havokWasmUrl }));
  scene.enablePhysics(new Vector3(0, GRAVITY, 0), havok);
  const physics = scene.getPhysicsEngine()!;
  physics.setTimeStep(FIXED_DT);

  const camera = new UniversalCamera("camera", new Vector3(0, 4, -16), scene);
  camera.fov = 0.9;
  camera.minZ = 0.1;
  camera.inputs.clear(); // the camera system drives it

  const world = new World();
  registerDisposers(world);
  const { shadows } = setupLook(scene, camera);

  const ctx: GameContext = {
    world, scene, physics: physics as GameContext["physics"], havok, camera,
    keyboard: new Keyboard(), mouse: new Mouse(canvas), materials: createMaterials(scene), shadows,
    view: { yaw: 0, pitch: 0.32 },
    fight: { state: "fighting", time: 0 },
    shake: 0,
  };
  buildArena(ctx);

  // R restarts. Runs first in the fixed step so the new bodies are simulated this tick.
  const restart: System = () => {
    if (ctx.keyboard.consumePressed("KeyR")) startFight(ctx);
  };

  // System order is the game's contract. Fixed systems run at 60 Hz, render systems once per frame.
  const beforePhysics: System[] = [restart, inputSystem(ctx), playerSystem(), boarSystem(ctx)];
  const afterPhysics: System[] = [groundSystem(ctx), combatSystem(ctx)];
  const render: System[] = [cameraSystem(ctx), spriteSystem(ctx), boarViewSystem(), hudSystem(ctx, hud)];

  scene.onBeforeStepObservable.add(() => {
    for (const s of beforePhysics) s(world, FIXED_DT);
  });
  scene.onAfterStepObservable.add(() => {
    for (const s of afterPhysics) s(world, FIXED_DT);
    world.flush();
  });
  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);
    for (const s of render) s(world, dt);
  });

  startFight(ctx);
  engine.runRenderLoop(() => scene.render());
  window.addEventListener("resize", () => engine.resize());

  // Dev handle: inspect from the browser console.
  if (import.meta.env.DEV || new URLSearchParams(location.search).has("debug")) {
    Object.assign(window, {
      game: ctx,
      components: { Player, LocalPlayer, Boar, Health, Stamina, Fighter, ActiveHit, Body, BoarView, SpriteView },
    });
  }
}

main().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML("beforeend", `<pre style="color:#f88;padding:16px">${String(err)}</pre>`);
});
