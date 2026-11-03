import { LocalPlayer, Player, useSteps, type EnemyId, type ServerMsgOf } from "@infinite-tower/shared";
import type { Audio } from "../audio/audio.js";
import type { Battle } from "../modes/battle/battle.js";
import type { Actions } from "../core/actions.js";
import type { Overworld } from "../modes/overworld/overworld.js";
import type { Joined, Net } from "../net/net.js";
import { restoreSettings, syncSettings, type Settings } from "../settings/settings.js";
import { say } from "../ui/notifications/say.js";
import { NO_CHANT } from "../ui/skills/chant.js";
import { whoHasTheKeys, type GameRequests, type UiState } from "../ui/state.js";
import { setDayClock } from "../visuals/sky/daylight.js";
import type { Drawing } from "../visuals/visuals.js";
import { exposeDebugHandles } from "./debug.js";
import { hear } from "./hear.js";
import { createRequests, type Session } from "./requests.js";
import { startTransition, stepTransition, type Mode, type Transition } from "./transition.js";

/** A stalled tab's first frame back counts as this long at most, so it doesn't make a huge step. */
const MAX_FRAME_TIME = 0.1;

export interface Game extends GameRequests {
  /** null outside a session. */
  mode(): Mode | null;
  /** On a connection the server has welcomed. */
  join(joined: Joined): void;
  leave(): void;
}

interface GameParts {
  drawing: Drawing;
  audio: Audio;
  actions: Actions;
  ui: UiState;
  settings: Settings;
  battle: Battle;
  overworld: Overworld;
}

export function createGame({ drawing, audio, actions, ui, settings, battle, overworld }: GameParts): Game {
  let mode: Mode | null = null;
  let net: Net | null = null;
  let stopSync = () => {};
  let transition: Transition | null = null;
  /** The fight being flashed into. */
  let encounter: ServerMsgOf<"encounter"> | null = null;
  /** Held while the player is still in the arena, for where they come back and what they're told. */
  let result: ServerMsgOf<"battleResult"> | null = null;
  /** A resync can replay a use onto a later step; two can't end within the second's use time, so it's told once. */
  let lastUsedStep = -Infinity;

  /**
   * The game only gets input during a session with no screen over it (not even the title, still clearing off the
   * world, nor the open bag), and the mouse only in the arena (captured at once there if Auto mouse lock is on).
   */
  const updateInput = () => actions.setLayers(whoHasTheKeys(ui, mode));
  for (const store of ui.keyStores) store.subscribe(updateInput);
  updateInput();

  const setMode = (next: Mode | null) => {
    mode = next;
    // Panels are the overworld's: a fight, or leaving, closes them.
    if (next !== "overworld") ui.closeOverworldPanel();
    ui.closeBattleBag();
    ui.leaveArena.set({ asking: false });
    ui.closeDialogue();
    ui.closeQuestbook();
    ui.chant.set(NO_CHANT);
    ui.screen.set({ mode: next });
    drawing.show(next);
    updateInput();
  };

  const enterBattle = (msg: ServerMsgOf<"encounter">) => {
    if (!net) return;
    result = null;
    lastUsedStep = -Infinity;
    battle.start(msg, net);
    const enemy = msg.setup.enemies[0]?.def ?? { name: "something" };
    const rival = msg.setup.duel ? msg.setup.players[1 - msg.seat]?.who : undefined;
    if (rival) say(ui.notifications, { kind: "duel", with: rival.name });
    else if (msg.joined) say(ui.notifications, { kind: "joinedFight", host: msg.joined.host });
    else say(ui.notifications, { kind: "encounter", source: msg.source, enemy });
    setMode("battle");
  };

  const enterOverworld = () => {
    battle.end();
    net?.send({ t: "leaveBattle" });
    if (result) {
      overworld.backFromBattle(result.me);
      ui.skills.set({ book: result.skillbook });
      say(ui.notifications, { kind: "battleResult", outcome: result });
      result = null;
    }
    setMode("overworld");
  };

  let frameRequest = 0, lastFrameMs = 0;
  const loop = (atMs: number) => {
    frame(Math.min(Math.max(0, atMs - lastFrameMs) / 1000, MAX_FRAME_TIME));
    lastFrameMs = atMs;
    frameRequest = requestAnimationFrame(loop);
  };

  const frame = (dt: number) => {
    if (transition) {
      const fade = stepTransition(transition, dt);
      ui.screen.set({ fadeColor: fade.color, fadeOpacity: fade.opacity });
      if (fade.swapNow) {
        if (transition.to === "overworld") enterOverworld();
        else if (encounter) {
          enterBattle(encounter);
          encounter = null;
        }
      }
      if (fade.done) transition = null;
    }
    if (mode === "overworld") overworld.update(dt, transition !== null);
    else if (mode === "battle") {
      battle.update(dt);
      for (const { step, event } of battle.ctx.events) {
        if (event.type !== "used" || step - lastUsedStep < useSteps(event.item)) continue;
        const fight = battle.ctx.fight;
        if (!fight?.world.has(event.player, LocalPlayer)) continue;
        lastUsedStep = step;
        say(ui.notifications, { kind: "itemUsed", item: event.item });
        const { core } = fight.world.require(event.player, Player);
        if (event.brokeThrough) say(ui.notifications, { kind: "breakthrough", core });
      }
    }
    drawing.frame(dt);
    audio.frame(mode);
  };

  const session: Session = { mode: () => mode, switching: () => transition !== null, net: () => net };
  return {
    ...createRequests(session, { ui, audio, battle, overworld }),
    mode: () => mode,
    setDayClock,
    leaveBattle(sure = false) {
      if (mode !== "battle" || transition || !result) return;
      if (!sure && battle.ctx.drops.length > 0) ui.leaveArena.set({ asking: true });
      else transition = startTransition("overworld");
    },
    join(joined) {
      audio.unlock();
      net = joined.net;
      restoreSettings(settings, joined.welcome.settings);
      stopSync = syncSettings(settings, net);
      net.onPing((ms) => ui.ping.set({ ms }));
      overworld.join(joined);
      net.on("encounter", (msg) => {
        ui.challenge.set({ from: null });
        encounter = msg;
        transition = startTransition("battle");
      });
      net.on("battleJoined", ({ player }) => {
        // Still flashing in: the fight is built with them in it.
        if (encounter) encounter.setup.players.push(player);
        if (player.who) say(ui.notifications, { kind: "joinedYou", who: player.who.name });
      });
      hear(joined, ui);
      net.on("battleResult", (msg) => {
        result = msg;
        battle.onResult(msg);
      });
      net.on("arenaClosed", () => {
        if (mode === "battle" && !transition) transition = startTransition("overworld");
      });
      setMode("overworld");
      lastFrameMs = performance.now();
      frameRequest = requestAnimationFrame(loop);
      exposeDebugHandles({
        battle, overworld, ui, settings, audio, mode: () => mode,
        encounter: (enemy: EnemyId = "wild-boar") => net?.send({ t: "cheat", cheat: { kind: "encounter", enemy } }),
      });
    },
    leave() {
      if (!net) return;
      stopSync();
      stopSync = () => {};
      cancelAnimationFrame(frameRequest);
      audio.frame(null);
      net.close();
      net = null;
      if (mode === "battle") battle.end();
      transition = encounter = result = null;
      overworld.leave();
      ui.resetSession();
      setMode(null);
    },
  };
}

