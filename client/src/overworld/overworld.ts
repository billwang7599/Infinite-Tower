/**
 * The overworld mode: the 2D field. The server decides everything here (where you are, encounters,
 * the boars); this mode predicts your own walking, mirrors the boars, and draws.
 */
import type { Engine } from "@babylonjs/core";
import { FIXED_DT, type ServerMsg, type System, type World } from "@infinite-tower/shared";
import type { Keyboard } from "../core/input.js";
import type { Connection } from "../net/connection.js";
import { registerMapDisposers } from "./components.js";
import { Prediction } from "./prediction.js";
import { createMapScene, type MapView } from "./scene.js";
import { spawnMapPlayer } from "./spawn.js";
import { BoarMirror } from "./sync.js";
import { mapCameraSystem, snapMapCamera } from "./systems/camera.js";
import { readMapInput } from "./systems/input.js";
import { mapSpriteSystem } from "./systems/sprites.js";

type Welcome = Extract<ServerMsg, { t: "welcome" }>;
type Msg<T extends ServerMsg["t"]> = Extract<ServerMsg, { t: T }>;

export interface Overworld {
  view: MapView;
  /** Advance by real time `dt`; `frozen` pauses it (during transitions). */
  update(dt: number, frozen: boolean): void;
  /** Server messages for the field. */
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
  welcome: Welcome;
}

export function createOverworld(opts: OverworldOptions): Overworld {
  const { engine, world, keyboard, hud, net, welcome } = opts;
  const view = createMapScene(engine, welcome.field);
  registerMapDisposers(world);
  const player = spawnMapPlayer(world, view, welcome.me);
  const prediction = new Prediction(world, view, player, net);
  const boars = new BoarMirror(world, view);
  snapMapCamera(view, world);

  /** No walking between an encounter and the server's battle result. */
  let inFight = false;
  let wins = welcome.wins;
  let lastHud = "";

  const render: System[] = [mapSpriteSystem(welcome.field), mapCameraSystem(view)];
  view.scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);
    for (const s of render) s(world, dt);
  });

  let accumulator = 0;
  return {
    view,
    update(dt, frozen) {
      if (frozen || inFight) { accumulator = 0; return; }
      accumulator += dt;
      while (accumulator >= FIXED_DT) {
        prediction.step(readMapInput(keyboard));
        accumulator -= FIXED_DT;
      }
    },
    onState(msg) {
      if (inFight) return;
      prediction.reconcile(msg.ack, msg.me);
      boars.apply(msg.boars);
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
      const text = `Grass Field &nbsp;·&nbsp; boars defeated: ${wins}<br><small class="text-[13px] font-normal opacity-80">WASD / arrows to walk · touch a boar or walk through the tall grass to fight</small>`;
      if (text !== lastHud) { hud.innerHTML = text; lastHud = text; }
      view.scene.render();
    },
  };
}
