import {
  coreStats, distXZ, emptyTiles, FIXED_DT, HEADING_WAY, JOIN_RANGE_TILES, inView, INTERACT_RANGE_M,
  maxHpOf, nearCampfire, OVERWORLD_CAMERA_ANGLES, overworldPace, regionAt, REST_RANGE_TILES, staminaMaxOf,
  START_HEADING, wrapAngle, type CoreState,
  type Gear, type Heading, type Stats, type Vec2, type Vitals, type World, type WorldLayout,
} from "@infinite-tower/shared";
import { LocalPlayer } from "../components.js";
import type { Actions } from "../../core/actions.js";
import type { Joined, Net } from "../../net/net.js";
import type { CameraSettings } from "../../settings/camera.js";
import type { Interaction, OverworldHudState, YouState } from "../../ui/state.js";
import type { Store } from "../../ui/store.js";
import { OverworldActor, OverworldPos, Peer, Speech, type OverworldState } from "./components.js";
import { turnBy } from "../orbit.js";
import { CAMERA_PITCH, mapMove, unwrapTurns } from "./facing.js";
import { dropFar, hold, nothingHeld } from "./held.js";
import { ActorMirror } from "./mirror.js";
import { Prediction } from "./prediction.js";

export interface Overworld {
  state: OverworldState;
  join(joined: Joined): void;
  leave(): void;
  update(dt: number, frozen: boolean): void;
  backFromBattle(me: Vec2): void;
  setGear(gear: Gear): void;
  interact(): Interaction | null;
}

export function interactionAt(
  map: WorldLayout, at: Vec2, heading: Heading, fights: readonly Vec2[], piles: readonly Vec2[],
): Interaction | null {
  const faced = inView(at, HEADING_WAY[heading], [
    ...piles.map((pile) => ({ what: "openPile" as const, ...pile })),
    ...map.npcs.map((npc) => ({ what: "talk" as const, ...npc.at })),
    ...map.traces.map((trace) => ({ what: "look" as const, ...trace })),
    ...map.pads.map((pad) => ({ what: "bindPad" as const, ...pad })),
  ]);
  const reachable: [Interaction, readonly Vec2[], number][] = [
    ["rest", map.campfires, REST_RANGE_TILES], ["joinFight", fights, JOIN_RANGE_TILES],
  ];
  if (faced) reachable.push([faced.what, [faced], INTERACT_RANGE_M]);
  let best: { what: Interaction; dist: number } | null = null;
  for (const [what, spots, rangeTiles] of reachable) {
    for (const spot of spots) {
      const dist = distXZ(spot, at);
      if (dist <= rangeTiles && (!best || dist < best.dist)) best = { what, dist };
    }
  }
  return best?.what ?? null;
}

const INTERACT_MSG: Record<Interaction, "rest" | "joinBattle" | "openPile" | "talk" | "bindPad"> = {
  rest: "rest", joinFight: "joinBattle", openPile: "openPile", talk: "talk", look: "talk", bindPad: "bindPad",
};

const SPEECH_TIME = 6;

interface OverworldOptions {
  world: World;
  actions: Actions;
  hud: Store<OverworldHudState>;
  you: Store<YouState>;
  camera: CameraSettings;
}

export function createOverworld({ world, actions, hud, you, camera }: OverworldOptions): Overworld {
  const player = world.spawn();
  world.add(player, OverworldPos, { x: 0, z: 0 });
  world.add(player, OverworldActor, { kind: "player", vx: 0, vz: 0, heading: START_HEADING, alert: false });
  world.add(player, LocalPlayer, true);
  const state: OverworldState = {
    world, player, map: null, held: nothingHeld(), cameraTurns: camera.get().overworldTurns,
    cameraPitchRad: CAMERA_PITCH.startRad,
  };
  const actors = new ActorMirror(world);

  /** One per session (its input numbering starts over with the server's). */
  let prediction: Prediction | null = null;
  let net: Net | null = null;
  /** Until back from the arena with the result: no walking, and `state` is ignored. */
  let inBattle = false;
  let stats: Stats | null = null;
  let vitals: Vitals = { hp: 0, stamina: 0 };
  let gear: Gear | null = null;

  const playerPos = () => world.require(player, OverworldPos);
  const interaction = (): Interaction | null => {
    if (!prediction || inBattle || !state.map) return null;
    const fights = [...world.query(Peer, OverworldPos)].flatMap(([, peer, pos]) => (peer.fighting ? [pos] : []));
    const piles = [...world.query(OverworldActor, OverworldPos)]
      .flatMap(([, actor, pos]) => (actor.kind === "pile" ? [pos] : []));
    return interactionAt(state.map, playerPos(), world.require(player, OverworldActor).heading, fights, piles);
  };
  const interact = () => {
    const what = interaction();
    if (what) net?.send({ t: INTERACT_MSG[what] });
    return what;
  };
  const hush = () => { for (const [e] of world.query(Speech)) world.remove(e, Speech); };
  const setVitals = (v: Vitals) => {
    vitals = v;
    if (stats) hud.set({ hpFraction: v.hp / maxHpOf(stats), staminaFraction: v.stamina / staminaMaxOf(stats) });
  };
  const setGear = (next: Gear) => {
    gear = next;
    you.set({ gear: next });
    if (prediction && stats) prediction.pace = overworldPace(next, stats);
  };
  const setCore = (core: CoreState) => {
    stats = coreStats(core);
    you.set({ core });
    if (gear) setGear(gear);
    setVitals(vitals);
  };

  let accumulator = 0;
  return {
    state,
    join({ net: joinedNet, welcome }) {
      net = joinedNet;
      prediction = new Prediction(world, state, player, joinedNet);
      inBattle = false;
      hud.set({ regionName: "…" });
      you.set({ character: welcome.character, faith: welcome.faith });
      vitals = welcome.vitals;
      gear = welcome.gear;
      setCore(welcome.core);
      joinedNet.on("world", (msg) => {
        actors.enter(msg.world);
        state.map = { ...msg.world, tiles: emptyTiles(msg.world.bounds) };
        state.held = nothingHeld();
        prediction?.reset(msg.me);
        world.require(player, OverworldActor).heading = START_HEADING;
      });
      joinedNet.on("chunks", (msg) => {
        if (state.map) hold(state.map, state.held, msg.chunks);
      });
      joinedNet.on("npcs", (msg) => {
        if (!state.map) return;
        Object.assign(state.map, { npcs: msg.npcs, traces: msg.traces });
        actors.place(msg);
      });
      joinedNet.on("state", (msg) => {
        if (inBattle) return;
        prediction?.reconcile(msg.ack, msg.me);
        actors.apply(msg.actors, msg.players, msg.piles);
        if (msg.hp !== vitals.hp) setVitals({ ...vitals, hp: msg.hp });
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
      joinedNet.on("character", ({ character }) => you.set({ character }));
      joinedNet.on("faith", ({ faith }) => you.set({ faith }));
      joinedNet.on("using", ({ at }) => you.set({ using: at }));
      joinedNet.on("trade", (msg) => setGear(msg.gear));
      joinedNet.on("given", (msg) => setGear(msg.gear));
      joinedNet.on("rested", (msg) => setVitals(msg.vitals));
      joinedNet.on("healed", (msg) => setVitals(msg.vitals));
      joinedNet.on("itemUsed", (msg) => {
        you.set({ using: null });
        setVitals(msg.vitals);
        setGear(msg.gear);
      });
      joinedNet.on("core", (msg) => {
        setCore(msg.core);
        setVitals(msg.vitals);
      });
      // Applied while you're still in the arena, so what's used or absorbed there after a win counts on top of it.
      joinedNet.on("battleResult", (msg) => {
        setGear(msg.gear);
        setCore(msg.core);
        setVitals(msg.vitals);
      });
    },
    leave() {
      hush();
      prediction = null;
      net = null;
      inBattle = false;
      actors.clear();
      state.map = null;
      state.held = nothingHeld();
    },
    update(dt, frozen) {
      if (frozen || inBattle || !state.map || !prediction) accumulator = 0;
      else accumulator += dt;
      while (prediction && accumulator >= FIXED_DT) {
        const polled = actions.poll();
        const turned = turnBy(polled, { dx: 0, dy: 0 }, FIXED_DT, camera.get().sensitivity);
        if (turned.yaw !== 0) camera.turnOverworld((turned.yaw / (2 * Math.PI)) * OVERWORLD_CAMERA_ANGLES);
        state.cameraPitchRad = wrapAngle(state.cameraPitchRad + turned.pitch);
        const move = mapMove(polled.move, camera.get().overworldTurns);
        prediction.step({ moveX: move.x, moveZ: move.z });
        accumulator -= FIXED_DT;
      }
      for (const [e, speech] of world.query(Speech)) if ((speech.remainingTime -= dt) <= 0) world.remove(e, Speech);
      state.cameraTurns = camera.get().overworldTurns;
      const byFire = !inBattle && state.map !== null && nearCampfire(state.map, playerPos());
      const cameraTurns = unwrapTurns(hud.get().cameraTurns, state.cameraTurns);
      if (state.map && !inBattle) dropFar(state.map, state.held, playerPos());
      const at = playerPos(), regionName = state.map ? regionAt(state.map, at.x, at.z).name : "…";
      hud.set({ interaction: interaction(), byFire, cameraTurns, regionName });
    },
    backFromBattle(me) {
      inBattle = false;
      prediction?.reset(me);
    },
    setGear,
    interact,
  };
}
