import {
  distXZ, gearBurden, FIXED_DT, HEADING_WAY, JOIN_RANGE_TILES, LocalPlayer, pileInView, PILE_RANGE_M, PLAYER,
  REST_RANGE_TILES, START_HEADING, walkPace, type Gear, type Heading, type LevelLayout, type ServerMsgOf,
  type Stats, type Vec2, type Vitals, type World,
} from "@infinite-tower/shared";
import type { Actions } from "../../core/actions.js";
import type { Joined, Net } from "../../net/net.js";
import type { CameraSettings } from "../../settings/camera.js";
import type { Interaction, OverworldHudState } from "../../ui/state.js";
import type { Store } from "../../ui/store.js";
import { OverworldActor, OverworldPos, Peer, Speech, type OverworldState } from "./components.js";
import { mapMove } from "./facing.js";
import { ActorMirror } from "./mirror.js";
import { Prediction } from "./prediction.js";

export interface Overworld {
  state: OverworldState;
  /** A session starts: your walking goes to this connection, which sends the level next. */
  join(joined: Joined): void;
  /** The session ended: forget the level and its actors. */
  leave(): void;
  update(dt: number, frozen: boolean): void;
  onBattleResult(msg: ServerMsgOf<"battleResult">): void;
  /** Rested, or used an item. */
  setVitals(vitals: Vitals): void;
  setGear(gear: Gear): void;
  interact(): Interaction | null;
}

export function interactionAt(
  level: LevelLayout, at: Vec2, heading: Heading, fights: readonly Vec2[], piles: readonly Vec2[],
): Interaction | null {
  const seen = pileInView(at, HEADING_WAY[heading], piles);
  const reachable: [Interaction, readonly Vec2[], number][] = [
    ["rest", level.campfires, REST_RANGE_TILES], ["joinFight", fights, JOIN_RANGE_TILES],
    ["openPile", seen ? [seen] : [], PILE_RANGE_M],
  ];
  let best: { what: Interaction; dist: number } | null = null;
  for (const [what, spots, rangeTiles] of reachable) {
    for (const spot of spots) {
      const dist = distXZ(spot, at);
      if (dist <= rangeTiles && (!best || dist < best.dist)) best = { what, dist };
    }
  }
  return best?.what ?? null;
}

const INTERACT_MSG: Record<Interaction, "rest" | "joinBattle" | "openPile"> = {
  rest: "rest", joinFight: "joinBattle", openPile: "openPile",
};

const SPEECH_TIME = 6;

interface OverworldOptions {
  world: World;
  actions: Actions;
  hud: Store<OverworldHudState>;
  camera: CameraSettings;
}

export function createOverworld({ world, actions, hud, camera }: OverworldOptions): Overworld {
  const player = world.spawn();
  world.add(player, OverworldPos, { x: 0, z: 0 });
  world.add(player, OverworldActor, { kind: "player", vx: 0, vz: 0, heading: START_HEADING, alert: false });
  world.add(player, LocalPlayer, true);
  const state: OverworldState = { world, player, level: null, cameraTurns: camera.get().overworldTurns };
  const actors = new ActorMirror(world);

  /** One per session (its input numbering starts over with the server's). */
  let prediction: Prediction | null = null;
  let net: Net | null = null;
  /** Until back from the arena with the result: no walking, and `state` is ignored. */
  let inBattle = false;
  /** From `welcome`: stats don't change during a session. */
  let stats: Stats | null = null;

  const playerPos = () => world.require(player, OverworldPos);
  const interaction = (): Interaction | null => {
    if (!prediction || inBattle || !state.level) return null;
    const fights = [...world.query(Peer, OverworldPos)].flatMap(([, peer, pos]) => (peer.fighting ? [pos] : []));
    const piles = [...world.query(OverworldActor, OverworldPos)]
      .flatMap(([, actor, pos]) => (actor.kind === "pile" ? [pos] : []));
    return interactionAt(state.level, playerPos(), world.require(player, OverworldActor).heading, fights, piles);
  };
  const interact = () => {
    const what = interaction();
    if (what) net?.send({ t: INTERACT_MSG[what] });
    return what;
  };
  const hush = () => { for (const [e] of world.query(Speech)) world.remove(e, Speech); };
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
      hud.set({ levelName: "…", levelFloor: null, wins: welcome.wins, stats: welcome.stats });
      setGear(welcome.gear);
      setVitals(welcome.vitals);
      joinedNet.on("level", (msg) => {
        actors.clear();
        state.level = msg.level;
        prediction?.reset(msg.me);
        world.require(player, OverworldActor).heading = START_HEADING;
        hud.set({ levelName: msg.level.name, levelFloor: msg.level.floor });
      });
      joinedNet.on("state", (msg) => {
        if (inBattle) return;
        prediction?.reconcile(msg.ack, msg.me);
        actors.apply(msg.actors, msg.players, msg.piles);
      });
      joinedNet.on("encounter", (msg) => {
        inBattle = true;
        prediction?.reset(msg.me);
        hush();
      });
      joinedNet.on("chat", ({ line, speaker }) => {
        if (inBattle || speaker === null) return;
        const e = speaker === "you" ? player : actors.entityOf(speaker);
        if (e !== undefined) world.add(e, Speech, { text: line.text, remainingTime: SPEECH_TIME });
      });
      joinedNet.on("gear", (msg) => setGear(msg.gear));
    },
    leave() {
      hush();
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
        const polled = actions.poll();
        for (const press of polled.pressed) {
          if (press === "turnCameraLeft") camera.turnOverworld(-1);
          else if (press === "turnCameraRight") camera.turnOverworld(1);
        }
        const move = mapMove(polled.move, camera.get().overworldTurns);
        prediction.step({ moveX: move.x, moveZ: move.z });
        accumulator -= FIXED_DT;
      }
      for (const [e, speech] of world.query(Speech)) if ((speech.remainingTime -= dt) <= 0) world.remove(e, Speech);
      state.cameraTurns = camera.get().overworldTurns;
      hud.set({ interaction: interaction() });
    },
    onBattleResult(msg) {
      inBattle = false;
      prediction?.reset(msg.me);
      hud.set({ wins: msg.wins });
      setVitals(msg.vitals);
    },
    setVitals,
    setGear,
    interact,
  };
}
