/**
 * The battle mode: the 2.5D arena with Havok physics. Owns its Babylon scene and the fixed-step
 * system lists. Babylon's deterministic lockstep runs onBeforeStep / physics / onAfterStep at
 * FIXED_DT, so the arena only simulates while its scene is the one being rendered.
 */
import { HavokPlugin, Scene, UniversalCamera, Vector3, type Engine } from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";
import havokWasmUrl from "@babylonjs/havok/lib/esm/HavokPhysics.wasm?url";
import { FIXED_DT, Fighter, GRAVITY, type ArenaDef, type EnemyDef, type Entity, type System, type World } from "@infinite-tower/shared";
import type { Keyboard } from "../core/input.js";
import type { Mouse } from "../core/mouse.js";
import { buildArena } from "./arena.js";
import { registerDisposers } from "./components.js";
import type { GameContext } from "./context.js";
import { setupLook } from "./look.js";
import { createMaterials } from "./materials.js";
import { chargeAttackSystem } from "./enemies/behaviors/charge.js";
import { enemyBrainSystem } from "./enemies/behaviors/brain.js";
import { goreAttackSystem } from "./enemies/behaviors/gore.js";
import { enemyMotorSystem } from "./enemies/behaviors/motor.js";
import { boarViewSystem } from "./enemies/models/boarView.js";
import { spawnEnemy } from "./enemies/spawn.js";
import { spawnPlayer } from "./player/spawn.js";
import { cameraSystem } from "./systems/camera.js";
import { combatSystem } from "./systems/combat.js";
import { groundSystem } from "./systems/ground.js";
import { hudSystem } from "./systems/hud.js";
import { inputSystem } from "./systems/input.js";
import { playerSystem } from "./systems/player.js";
import { spriteSystem } from "./systems/sprite.js";

export interface Battle {
  ctx: GameContext;
  /** Spawn the player and the enemy facing each other, in the given arena (both from the server's encounter). */
  start(enemy: EnemyDef, arena: ArenaDef): void;
  /** Remove the fighters. Returns whether the player won. */
  end(): boolean;
  render(): void;
}

export interface BattleOptions {
  engine: Engine;
  world: World;
  keyboard: Keyboard;
  mouse: Mouse;
  hud: HTMLElement;
  /** Called when the player asks to leave a decided fight (Enter / E). */
  onLeave: () => void;
}

export async function createBattle(opts: BattleOptions): Promise<Battle> {
  const { engine, world, keyboard, mouse } = opts;
  const scene = new Scene(engine);
  const havok = new HavokPlugin(true, await HavokPhysics({ locateFile: () => havokWasmUrl }));
  scene.enablePhysics(new Vector3(0, GRAVITY, 0), havok);
  const physics = scene.getPhysicsEngine()!;
  physics.setTimeStep(FIXED_DT);

  const camera = new UniversalCamera("camera", new Vector3(0, 4, -16), scene);
  camera.fov = 0.9;
  camera.minZ = 0.1;
  camera.inputs.clear(); // the camera system drives it

  registerDisposers(world);
  const { shadows } = setupLook(scene, camera);
  const ctx: GameContext = {
    world, scene, physics: physics as GameContext["physics"], havok, camera,
    keyboard, mouse, materials: createMaterials(scene), shadows, arena: { radius: 0 },
    view: { yaw: 0, pitch: 0.32, lock: true },
    fight: { state: "fighting", time: 0 },
    shake: 0,
  };
  let arenaParts: Entity[] | null = null;
  /** Build the arena on the first fight; rebuild only if the next one is a different size. */
  const useArena = (arena: ArenaDef) => {
    if (arenaParts && arena.radius === ctx.arena.radius) return;
    for (const e of arenaParts ?? []) world.destroy(e);
    world.flush();
    ctx.arena = { ...arena };
    arenaParts = buildArena(ctx);
  };

  // After the fight: Enter / E leaves (once the result has been on screen for a moment).
  const leaveSystem: System = () => {
    const pressed = keyboard.consumePressed("Enter", "KeyE");
    if (pressed && ctx.fight.state !== "fighting" && ctx.fight.time > 1) opts.onLeave();
  };

  // Systems. Order is the game's contract.
  const beforePhysics: System[] = [
    leaveSystem, inputSystem(ctx), playerSystem(),
    enemyBrainSystem(), chargeAttackSystem(ctx), goreAttackSystem(), enemyMotorSystem(),
  ];
  const afterPhysics: System[] = [groundSystem(ctx), combatSystem(ctx)];
  const render: System[] = [cameraSystem(ctx), spriteSystem(ctx), boarViewSystem(), hudSystem(ctx, opts.hud)];

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

  const clear = () => {
    for (const [e] of world.query(Fighter)) world.destroy(e);
    world.flush();
  };

  return {
    ctx,
    start(enemy, arena) {
      clear();
      useArena(arena);
      spawnPlayer(ctx, "you", { x: 0, y: 0.05, z: -8 }, true);
      spawnEnemy(ctx, enemy, { x: 0, y: 0.05, z: 6 }, Math.PI);
      opts.hud.querySelector("#boss-name")!.textContent = enemy.name;
      ctx.view.yaw = 0;
      ctx.view.pitch = 0.32;
      ctx.view.lock = true;
      ctx.fight.state = "fighting";
      ctx.fight.time = 0;
      keyboard.clearPressed();
    },
    end() {
      const won = ctx.fight.state === "won";
      clear();
      return won;
    },
    render: () => scene.render(),
  };
}
