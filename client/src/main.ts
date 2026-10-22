import { Engine, HavokPlugin, Scene, UniversalCamera, Vector3 } from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";
import havokWasmUrl from "@babylonjs/havok/lib/esm/HavokPhysics.wasm?url";
import { World, GRAVITY, FIXED_DT, Player, LocalPlayer, Platform, type System } from "@infinite-tower/shared";
import { Body, registerDisposers } from "./components.js";
import type { GameContext } from "./context.js";
import { Keyboard } from "./input.js";
import { createMaterials } from "./materials.js";
import { setupLook } from "./scene.js";
import { spawnPlayer } from "./spawn.js";
import { inputSystem } from "./systems/input.js";
import { movementSystem } from "./systems/movement.js";
import { groundSystem } from "./systems/ground.js";
import { progressSystem } from "./systems/progress.js";
import { towerSystem } from "./systems/tower.js";
import { spriteSystem } from "./systems/sprite.js";
import { cameraSystem } from "./systems/camera.js";
import { hudSystem } from "./systems/hud.js";

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

  const camera = new UniversalCamera("camera", new Vector3(0, 4, -13), scene);
  camera.fov = 0.75;
  camera.minZ = 0.1;
  camera.inputs.clear(); // the camera system drives it

  const world = new World();
  registerDisposers(world);

  const ctx: GameContext = {
    world, scene, physics: physics as GameContext["physics"], havok, camera,
    keyboard: new Keyboard(), materials: createMaterials(scene),
    seed: Number(new URLSearchParams(location.search).get("seed") ?? 1337),
  };
  const { lantern } = setupLook(scene, camera);

  // System order is the game's contract. Fixed systems run at 60 Hz, render systems once per frame.
  const beforePhysics: System[] = [inputSystem(ctx), movementSystem()];
  const afterPhysics: System[] = [groundSystem(ctx), progressSystem(ctx), towerSystem(ctx)];
  const render: System[] = [spriteSystem(ctx), cameraSystem(ctx, lantern), hudSystem(ctx, hud)];

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

  spawnPlayer(ctx, "you", { x: 0, y: 0.05, z: -1 }, true);
  // Generate the first floors before the first frame.
  for (const s of afterPhysics) s(world, 0);

  engine.runRenderLoop(() => scene.render());
  window.addEventListener("resize", () => engine.resize());

  // Dev handle: inspect from the browser console.
  if (import.meta.env.DEV || new URLSearchParams(location.search).has("debug")) {
    Object.assign(window, { game: ctx, components: { Player, LocalPlayer, Platform, Body } });
  }
}

main().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML("beforeend", `<pre style="color:#f88;padding:16px">${String(err)}</pre>`);
});
