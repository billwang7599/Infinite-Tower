import {
  gearBurden, FIXED_DT, LocalPlayer, nearCampfire, PLAYER, walkPace, type Gear, type ServerMsgOf, type Stats,
  type Vitals, type WalkInput, type World,
} from "@infinite-tower/shared";
import type { Actions, Polled } from "../../core/actions.js";
import type { Connection, Joined } from "../../net/connection.js";
import type { OverworldHudState } from "../../ui/state.js";
import type { Store } from "../../ui/store.js";
import { OverworldActor, OverworldPos, type OverworldState } from "./components.js";
import { ActorMirror } from "./mirror.js";
import { Prediction } from "./prediction.js";

export interface Overworld {
  state: OverworldState;
  /** A session starts: your walking goes to this connection, which sends the level next. */
  join(joined: Joined): void;
  /** The session ended: forget the level and its actors. */
  leave(): void;
  update(dt: number, frozen: boolean): void;
  onLevel(msg: ServerMsgOf<"level">): void;
  onState(msg: ServerMsgOf<"state">): void;
  /** Walking stops until the player is back from the arena with the battle's result. */
  onEncounter(msg: ServerMsgOf<"encounter">): void;
  onBattleResult(msg: ServerMsgOf<"battleResult">): void;
  /** Rested, or used an item. */
  setVitals(vitals: Vitals): void;
  setGear(gear: Gear): void;
  /** The Rest key, or the HUD's button. */
  rest(): void;
}

interface OverworldOptions {
  world: World;
  actions: Actions;
  hud: Store<OverworldHudState>;
}

export function createOverworld({ world, actions, hud }: OverworldOptions): Overworld {
  const player = world.spawn();
  world.add(player, OverworldPos, { x: 0, z: 0 });
  world.add(player, OverworldActor, { kind: "player", vx: 0, vz: 0, facing: "down", alert: false });
  world.add(player, LocalPlayer, true);
  const state: OverworldState = { world, player, level: null };
  const actors = new ActorMirror(world);

  /** One per session (its input numbering starts over with the server's). */
  let prediction: Prediction | null = null;
  let net: Connection | null = null;
  /** Until back from the arena with the result: no walking, and `state` is ignored. */
  let inBattle = false;
  /** From `welcome`: stats don't change during a session. */
  let stats: Stats | null = null;

  const playerPos = () => world.require(player, OverworldPos);
  /** Walking a level (not in or leaving a battle), next to a campfire. */
  const byCampfire = () => !!prediction && !inBattle && !!state.level && nearCampfire(state.level, playerPos());
  const rest = () => {
    if (byCampfire()) net?.send({ t: "rest" });
  };
  const setVitals = (v: Vitals) =>
    hud.set({ hpFraction: v.hp / PLAYER.maxHp, staminaFraction: v.stamina / (stats?.stamina ?? 1) });
  const setGear = (gear: Gear) => {
    hud.set({ gear });
    if (prediction && stats) prediction.pace = walkPace(gearBurden(gear, stats));
  };

  let accumulator = 0;
  return {
    state,
    join({ net: joinedNet, welcome }) {
      net = joinedNet;
      prediction = new Prediction(world, state, player, joinedNet);
      inBattle = false;
      stats = welcome.stats;
      hud.set({ levelName: "…", wins: welcome.wins, stats: welcome.stats });
      setGear(welcome.gear);
      setVitals(welcome.vitals);
    },
    leave() {
      prediction = null;
      net = null;
      inBattle = false;
      actors.clear();
      state.level = null;
    },
    update(dt, frozen) {
      if (frozen || inBattle || !state.level || !prediction) accumulator = 0;
      else accumulator += dt;
      while (prediction && accumulator >= FIXED_DT) {
        prediction.step(readWalkInput(actions.poll()));
        accumulator -= FIXED_DT;
      }
      hud.set({ nearCampfire: byCampfire() });
    },
    onLevel(msg) {
      actors.clear();
      state.level = msg.level;
      prediction?.reset(msg.me);
      hud.set({ levelName: msg.level.name });
    },
    onState(msg) {
      if (inBattle) return;
      prediction?.reconcile(msg.ack, msg.me);
      actors.apply(msg.actors);
    },
    onEncounter(msg) {
      inBattle = true;
      prediction?.reset(msg.me);
    },
    onBattleResult(msg) {
      inBattle = false;
      prediction?.reset(msg.me);
      hud.set({ wins: msg.wins });
      setGear(msg.gear);
      setVitals(msg.vitals);
    },
    setVitals,
    setGear,
    rest,
  };
}

/** Screen-aligned: forward is up the map, +z. */
function readWalkInput(polled: Polled): WalkInput {
  return { moveX: polled.move.x, moveZ: polled.move.z };
}
