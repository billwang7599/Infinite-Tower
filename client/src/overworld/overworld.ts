/**
 * The overworld mode: the 2D field. It has no physics engine, so it runs its own fixed-step loop.
 * Rules (walking, encounters, boar AI) come from @infinite-tower/shared; this wires and draws them.
 */
import type { Engine } from "@babylonjs/core";
import {
  FIXED_DT, MAP, MapBoar, MapPlayer, MapPos, mapBoarSystem, mapPlayerSystem, type Entity, type System, type World,
} from "@infinite-tower/shared";
import type { Keyboard } from "../core/input.js";
import { registerMapDisposers } from "./components.js";
import { createMapScene, type MapView } from "./scene.js";
import { spawnMapBoar, spawnMapPlayer } from "./spawn.js";
import { mapCameraSystem, snapMapCamera } from "./systems/camera.js";
import { mapInputSystem } from "./systems/input.js";
import { mapSpriteSystem } from "./systems/sprites.js";

export interface Overworld {
  view: MapView;
  /** Advance the simulation by real time `dt`; `frozen` pauses it (during transitions). */
  update(dt: number, frozen: boolean): void;
  /** Back from a fight. `source` is the map boar that started it (null: tall grass). */
  returnFromFight(won: boolean, source: Entity | null): void;
  render(): void;
}

export interface OverworldOptions {
  engine: Engine;
  world: World;
  keyboard: Keyboard;
  hud: HTMLElement;
  onEncounter: (source: Entity | null) => void;
}

export function createOverworld(opts: OverworldOptions): Overworld {
  const { engine, world, keyboard, hud } = opts;
  const view = createMapScene(engine);
  registerMapDisposers(world);
  const player = spawnMapPlayer(world, view, MAP.spawn);
  spawnMapBoar(world, view, { x: 8, z: -6 });
  snapMapCamera(view, world);

  let encountered = false;
  let boarRespawn = 0;
  let wins = 0;
  let lastHud = "";
  const onEncounter = (source: Entity | null) => {
    encountered = true;
    opts.onEncounter(source);
  };

  /** Replace a defeated map boar after a while, on the far side from the player. */
  const respawnSystem: System = (w, dt) => {
    if (boarRespawn <= 0 || w.first(MapBoar)) return;
    boarRespawn -= dt;
    if (boarRespawn > 0) return;
    const me = w.require(player, MapPos);
    const x = me.x > 0 ? -MAP.halfWidth + 5 : MAP.halfWidth - 5;
    spawnMapBoar(w, view, { x, z: (Math.random() - 0.5) * MAP.halfDepth });
  };

  const fixed: System[] = [
    mapInputSystem(keyboard), mapPlayerSystem(Math.random, onEncounter), mapBoarSystem(Math.random, onEncounter), respawnSystem,
  ];
  const render: System[] = [mapSpriteSystem(), mapCameraSystem(view)];
  view.scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);
    for (const s of render) s(world, dt);
  });

  let accumulator = 0;
  return {
    view,
    update(dt, frozen) {
      if (frozen) { accumulator = 0; return; }
      encountered = false;
      accumulator += dt;
      while (accumulator >= FIXED_DT && !encountered) {
        for (const s of fixed) { s(world, FIXED_DT); if (encountered) break; }
        world.flush();
        accumulator -= FIXED_DT;
      }
    },
    returnFromFight(won, source) {
      const mp = world.require(player, MapPlayer);
      const pos = world.require(player, MapPos);
      if (won) {
        wins++;
        if (source !== null && world.isAlive(source)) {
          world.destroy(source);
          world.flush();
          boarRespawn = MAP.boar.respawn;
        }
      } else {
        pos.x = MAP.spawn.x; // you wake up back at the start
        pos.z = MAP.spawn.z;
        snapMapCamera(view, world);
      }
      mp.safeTime = MAP.safeTime;
      mp.grassDist = 0;
    },
    render() {
      const text = `Grass Field &nbsp;·&nbsp; boars defeated: ${wins}<br><small class="text-[13px] font-normal opacity-80">WASD / arrows to walk · touch a boar or walk through the tall grass to fight</small>`;
      if (text !== lastHud) { hud.innerHTML = text; lastHud = text; }
      view.scene.render();
    },
  };
}
