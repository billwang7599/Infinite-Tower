/**
 * The overworld mode: the 2D field. The server decides everything here (which level, where you are,
 * encounters, the actors); this mode predicts your own walking, mirrors the actors, and draws.
 */
import type { Engine } from "@babylonjs/core";
import { FIXED_DT, type MsgOf, type ServerMsg, type System, type World } from "@infinite-tower/shared";
import type { Keyboard } from "../core/input.js";
import type { Connection } from "../net/connection.js";
import { registerMapDisposers } from "./components.js";
import { spawnMapPlayer } from "./entities/player.js";
import { ActorMirror } from "./mirror.js";
import { Prediction } from "./prediction.js";
import { createMapScene, loadLevel, type MapView } from "./scene.js";
import { mapCameraSystem, snapMapCamera } from "./systems/camera.js";
import { readMapInput } from "./systems/input.js";
import { mapSpriteSystem } from "./systems/sprites.js";

type Msg<T extends ServerMsg["t"]> = MsgOf<ServerMsg, T>;

export interface Overworld {
  view: MapView;
  /** Advance by real time `dt`; `frozen` pauses it (during transitions). */
  update(dt: number, frozen: boolean): void;
  /** Server messages for the field. */
  onLevel(msg: Msg<"level">): void;
  onState(msg: Msg<"state">): void;
  onEncounter(msg: Msg<"encounter">): void;
  onBattleResult(msg: Msg<"battleResult">): void;
  /** Left the arena: stop walking until the server's result arrives. */
  awaitResult(): void;
  render(): void;
}

export interface OverworldOptions {
  engine: Engine;
  world: World;
  keyboard: Keyboard;
  hud: HTMLElement;
  net: Connection;
  /** Progress from the server's welcome. */
  wins: number;
}

export function createOverworld(opts: OverworldOptions): Overworld {
  const { engine, world, keyboard, hud, net } = opts;
  const view = createMapScene(engine);
  registerMapDisposers(world);
  const player = spawnMapPlayer(world, view, { x: 0, z: 0 });
  const prediction = new Prediction(world, view, player, net);
  const actors = new ActorMirror(world, view);

  /** No walking between an encounter and the server's battle result. */
  let inFight = false;
  let wins = opts.wins;
  let lastHud = "";

  const render: System[] = [mapSpriteSystem(view), mapCameraSystem(view)];
  view.scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);
    for (const s of render) s(world, dt);
  });

  let accumulator = 0;
  return {
    view,
    update(dt, frozen) {
      if (frozen || inFight || !view.level) { accumulator = 0; return; }
      accumulator += dt;
      while (accumulator >= FIXED_DT) {
        prediction.step(readMapInput(keyboard));
        accumulator -= FIXED_DT;
      }
    },
    onLevel(msg) {
      actors.clear();
      loadLevel(view, msg.level);
      prediction.reset(msg.me);
      snapMapCamera(view, world);
    },
    onState(msg) {
      if (inFight) return;
      prediction.reconcile(msg.ack, msg.me);
      actors.apply(msg.actors);
      wins = msg.wins;
    },
    onEncounter(msg) {
      inFight = true;
      prediction.reset(msg.me);
    },
    onBattleResult(msg) {
      inFight = false;
      wins = msg.wins;
      prediction.reset(msg.me);
      snapMapCamera(view, world);
    },
    awaitResult() {
      inFight = true;
    },
    render() {
      const name = view.level?.name ?? "…";
      const text = `${name} &nbsp;·&nbsp; boars defeated: ${wins}<br><small class="text-[13px] font-normal opacity-80">WASD / arrows to walk · touch a boar or walk through the tall grass to fight</small>`;
      if (text !== lastHud) { hud.innerHTML = text; lastHud = text; }
      view.scene.render();
    },
  };
}
