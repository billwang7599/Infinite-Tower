import { Engine, HavokPlugin, Scene, UniversalCamera, Vector3 } from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";
import havokWasmUrl from "@babylonjs/havok/lib/esm/HavokPhysics.wasm?url";
import {
  World, GRAVITY, FIXED_DT, MAP, Player, LocalPlayer, Boar, Health, Stamina, Fighter, ActiveHit,
  MapPlayer, MapBoar, MapPos, mapPlayerSystem, mapBoarSystem, type Entity, type System,
} from "@infinite-tower/shared";
import { Body, BoarView, SpriteView, registerDisposers } from "./components.js";
import type { GameContext } from "./context.js";
import { Keyboard, Mouse } from "./input.js";
import { createMaterials } from "./materials.js";
import { setupLook } from "./scene.js";
import { buildArena } from "./arena.js";
import { spawnBoar, spawnPlayer } from "./spawn.js";
import {
  createMap, mapInputSystem, mapViewSystem, registerMapDisposers, snapMapCamera, spawnMapBoar, spawnMapPlayer,
} from "./map.js";
import { inputSystem } from "./systems/input.js";
import { playerSystem } from "./systems/player.js";
import { boarSystem } from "./systems/boar.js";
import { groundSystem } from "./systems/ground.js";
import { combatSystem } from "./systems/combat.js";
import { spriteSystem } from "./systems/sprite.js";
import { boarViewSystem } from "./systems/boarView.js";
import { cameraSystem } from "./systems/camera.js";
import { hudSystem } from "./systems/hud.js";

/** Start an arena fight: spawn the player and the boar facing each other. */
function startFight(ctx: GameContext): void {
  endFight(ctx);
  spawnPlayer(ctx, "you", { x: 0, y: 0.05, z: -8 }, true);
  spawnBoar(ctx, { x: 0, y: 0.05, z: 6 }, Math.PI);
  ctx.view.yaw = 0;
  ctx.view.pitch = 0.32;
  ctx.fight.state = "fighting";
  ctx.fight.time = 0;
  ctx.keyboard.clearPressed();
}

/** Remove everything arena-specific (fighters and their bodies/views). */
function endFight(ctx: GameContext): void {
  for (const [e] of ctx.world.query(Fighter)) ctx.world.destroy(e);
  ctx.world.flush();
}

type Mode = "map" | "battle";
interface Transition { to: Mode; t: number; swapped: boolean }

/**
 * Two modes, two Babylon scenes, one ECS world:
 * - map:    2D overworld, its own fixed-step loop (no physics), rendered by the map scene.
 * - battle: the 2.5D arena, stepped by Babylon's lockstep + Havok, only while it is the scene being rendered.
 * Transitions: Pokemon-style flashes into battle, fade to black back to the map.
 */
async function main(): Promise<void> {
  const canvas = document.getElementById("game") as HTMLCanvasElement;
  const hud = document.getElementById("hud")!;
  const mapHud = document.getElementById("maphud")!;
  const fade = document.getElementById("fade")!;
  const toast = document.getElementById("toast")!;

  // Deterministic lockstep: Babylon runs scene.onBeforeStep / physics / onAfterStep at a fixed
  // FIXED_DT, as many times per frame as needed (max 4). Rendering runs once per frame.
  const engine = new Engine(canvas, true, {
    deterministicLockstep: true,
    lockstepMaxSteps: 4,
    timeStep: FIXED_DT,
  });

  // ---- Battle scene (arena).
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
  registerMapDisposers(world);
  const { shadows } = setupLook(scene, camera);

  const ctx: GameContext = {
    world, scene, physics: physics as GameContext["physics"], havok, camera,
    keyboard: new Keyboard(), mouse: new Mouse(canvas), materials: createMaterials(scene), shadows,
    view: { yaw: 0, pitch: 0.32 },
    fight: { state: "fighting", time: 0 },
    shake: 0,
  };
  buildArena(ctx);

  // ---- Map scene (overworld).
  const map = createMap(engine);
  const mapPlayer = spawnMapPlayer(world, map, MAP.spawn);
  spawnMapBoar(world, map, { x: 8, z: -6 });

  // ---- Mode switching.
  let mode: Mode = "map";
  let transition: Transition | null = null;
  let encounterSource: Entity | null = null;
  let boarRespawn = 0;
  let wins = 0;

  const setMode = (m: Mode) => {
    mode = m;
    hud.dataset.mode = m;
    mapHud.style.display = m === "map" ? "" : "none";
    ctx.mouse.canLock = m === "battle";
    if (m === "map") ctx.mouse.release();
  };

  const onEncounter = (source: Entity | null) => {
    if (mode !== "map" || transition) return;
    encounterSource = source;
    transition = { to: "battle", t: 0, swapped: false };
  };

  const showToast = (text: string) => {
    toast.textContent = text;
    toast.className = "show";
    setTimeout(() => { toast.className = ""; }, 1800);
  };

  const swap = (to: Mode) => {
    if (to === "battle") {
      startFight(ctx);
      setMode("battle");
      showToast(encounterSource === null ? "A Wild Boar leaps out of the grass!" : "The Wild Boar attacks!");
      return;
    }
    // Back to the map with the fight's outcome.
    const won = ctx.fight.state === "won";
    endFight(ctx);
    const mp = world.require(mapPlayer, MapPlayer);
    const pos = world.require(mapPlayer, MapPos);
    if (won) {
      wins++;
      if (encounterSource !== null && world.isAlive(encounterSource)) {
        world.destroy(encounterSource);
        world.flush();
        boarRespawn = MAP.boar.respawn;
      }
    } else {
      pos.x = MAP.spawn.x; // you wake up back at the start
      pos.z = MAP.spawn.z;
      snapMapCamera(map, world);
    }
    mp.safeTime = MAP.safeTime;
    mp.grassDist = 0;
    ctx.keyboard.clearPressed();
    setMode("map");
  };

  /** Overlay: white flashes then black into battle; black fade back to the map. */
  const updateTransition = (dt: number) => {
    if (!transition) return;
    const tr = transition;
    tr.t += dt;
    let color = "#000", opacity = 0;
    if (tr.to === "battle") {
      const SWAP = 0.85, END = 1.25;
      if (tr.t < 0.6) { color = "#fff"; opacity = Math.floor(tr.t / 0.1) % 2 === 0 ? 0.85 : 0; }
      else if (tr.t < SWAP) opacity = (tr.t - 0.6) / (SWAP - 0.6);
      else opacity = 1 - (tr.t - SWAP) / (END - SWAP);
      if (tr.t >= SWAP && !tr.swapped) { tr.swapped = true; swap("battle"); }
      if (tr.t >= END) transition = null;
    } else {
      const SWAP = 0.4, END = 0.8;
      opacity = tr.t < SWAP ? tr.t / SWAP : 1 - (tr.t - SWAP) / (END - SWAP);
      if (tr.t >= SWAP && !tr.swapped) { tr.swapped = true; swap("map"); }
      if (tr.t >= END) transition = null;
    }
    fade.style.background = color;
    fade.style.opacity = transition ? String(Math.max(0, Math.min(1, opacity))) : "0";
  };

  /** Respawn the map boar some time after it was defeated, away from the player. */
  const respawnSystem: System = (w, dt) => {
    if (boarRespawn <= 0 || w.first(MapBoar)) return;
    boarRespawn -= dt;
    if (boarRespawn > 0) return;
    const me = w.require(mapPlayer, MapPos);
    const x = me.x > 0 ? -MAP.halfWidth + 5 : MAP.halfWidth - 5;
    spawnMapBoar(w, map, { x, z: (Math.random() - 0.5) * MAP.halfDepth });
  };

  // ---- Systems. Order is the game's contract.
  const mapFixed: System[] = [
    mapInputSystem(ctx.keyboard), mapPlayerSystem(Math.random, onEncounter), mapBoarSystem(Math.random, onEncounter), respawnSystem,
  ];
  const mapRender: System[] = [mapViewSystem(map)];

  // After the fight: Enter / E returns to the map.
  const continueSystem: System = () => {
    const pressed = ctx.keyboard.consumePressed("Enter", "KeyE");
    if (pressed && ctx.fight.state !== "fighting" && ctx.fight.time > 1 && !transition) {
      transition = { to: "map", t: 0, swapped: false };
    }
  };
  const beforePhysics: System[] = [continueSystem, inputSystem(ctx), playerSystem(), boarSystem(ctx)];
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
  map.scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);
    for (const s of mapRender) s(world, dt);
  });

  let mapAccumulator = 0;
  let lastHud = "";
  engine.runRenderLoop(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);
    updateTransition(dt);
    if (mode === "map") {
      // The map runs its own fixed step (it has no physics engine); frozen during transitions.
      if (!transition) {
        mapAccumulator += dt;
        while (mapAccumulator >= FIXED_DT && !transition) {
          for (const s of mapFixed) { s(world, FIXED_DT); if (transition) break; }
          world.flush();
          mapAccumulator -= FIXED_DT;
        }
      } else {
        mapAccumulator = 0;
      }
      const text = `Grass Field &nbsp;·&nbsp; boars defeated: ${wins}<br><small>WASD / arrows to walk · touch a boar or walk through the tall grass to fight</small>`;
      if (text !== lastHud) { mapHud.innerHTML = text; lastHud = text; }
      map.scene.render();
    } else {
      scene.render();
    }
  });
  window.addEventListener("resize", () => engine.resize());

  setMode("map");
  snapMapCamera(map, world);

  // Dev handle: inspect from the browser console.
  if (import.meta.env.DEV || new URLSearchParams(location.search).has("debug")) {
    Object.assign(window, {
      game: ctx, map, mode: () => mode,
      components: {
        Player, LocalPlayer, Boar, Health, Stamina, Fighter, ActiveHit, Body, BoarView, SpriteView, MapPlayer, MapBoar, MapPos,
      },
    });
  }
}

main().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML("beforeend", `<pre style="color:#f88;padding:16px">${String(err)}</pre>`);
});
