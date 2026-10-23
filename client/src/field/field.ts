/**
 * The field mode: the 2D top-down map. The server decides everything here (which level, where you
 * are, encounters, the actors); this mode predicts your own walking, mirrors the actors, and draws.
 */
import type { Engine } from "@babylonjs/core";
import { FIXED_DT, type MsgOf, type ServerMsg, type System, type World } from "@infinite-tower/shared";
import type { Keyboard } from "../core/keyboard.js";
import { frameSeconds } from "../core/time.js";
import type { Connection } from "../net/connection.js";
import type { FieldHudState } from "../ui/state.js";
import type { Store } from "../ui/store.js";
import { registerFieldDisposers } from "./components.js";
import { spawnFieldPlayer } from "./entities/player.js";
import { readWalkInput } from "./input.js";
import { loadLevel } from "./levels/index.js";
import { ActorMirror } from "./mirror.js";
import { Prediction } from "./prediction.js";
import type { FieldView } from "./scene.js";
import { fieldCameraSystem, snapFieldCamera } from "./systems/camera.js";
import { fieldSpriteSystem } from "./systems/sprites.js";

type Msg<T extends ServerMsg["t"]> = MsgOf<ServerMsg, T>;

export interface Field {
  view: FieldView;
  update(dt: number, frozen: boolean): void;
  onLevel(msg: Msg<"level">): void;
  onState(msg: Msg<"state">): void;
  onEncounter(msg: Msg<"encounter">): void;
  onBattleResult(msg: Msg<"battleResult">): void;
  /** Left the arena: stop walking until the server's result arrives. */
  awaitResult(): void;
  render(): void;
}

export interface FieldOptions {
  engine: Engine;
  world: World;
  view: FieldView;
  keyboard: Keyboard;
  hud: Store<FieldHudState>;
  net: Connection;
  wins: number;
}

export function createField(opts: FieldOptions): Field {
  const { engine, world, view, keyboard, net } = opts;
  registerFieldDisposers(world);
  const player = spawnFieldPlayer(world, view, { x: 0, z: 0 });
  const prediction = new Prediction(world, view, player, net);
  const actors = new ActorMirror(world, view);

  /** No walking between an encounter and the server's battle result. */
  let inFight = false;
  let wins = opts.wins;

  const render: System[] = [fieldSpriteSystem(view), fieldCameraSystem(view)];
  view.scene.onBeforeRenderObservable.add(() => {
    const dt = frameSeconds(engine);
    for (const s of render) s(world, dt);
  });

  let accumulator = 0;
  return {
    view,
    update(dt, frozen) {
      if (frozen || inFight || !view.level) { accumulator = 0; return; }
      accumulator += dt;
      while (accumulator >= FIXED_DT) {
        prediction.step(readWalkInput(keyboard));
        accumulator -= FIXED_DT;
      }
    },
    onLevel(msg) {
      actors.clear();
      loadLevel(view, msg.level);
      prediction.reset(msg.me);
      snapFieldCamera(view, world);
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
      snapFieldCamera(view, world);
    },
    awaitResult() {
      inFight = true;
    },
    render() {
      opts.hud.set({ levelName: view.level?.name ?? "…", wins });
      view.scene.render();
    },
  };
}
