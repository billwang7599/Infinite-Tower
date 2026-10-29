/**
 * Sessions and switching between the two modes (modes/overworld/, modes/battle/). A session (join -> leave) is one
 * connection; this keeps the settings in sync, and runs the transitions: an encounter flashes into battle, leaving a
 * decided fight fades back to the overworld, where the server's result is applied and told.
 */
import {
  bagCounts, moveGear, type Character, type Cheat, type DayChange, type EnemyId, type GridSpot, type ServerMsgOf,
  type Skill, type Spot,
} from "@infinite-tower/shared";
import type { Battle } from "../modes/battle/battle.js";
import type { Actions } from "../core/actions.js";
import type { Overworld } from "../modes/overworld/overworld.js";
import type { Joined, Net } from "../net/net.js";
import { restoreSettings, syncSettings, type Settings } from "../settings/settings.js";
import { say } from "../ui/notifications/say.js";
import { NO_CHANT } from "../ui/skills/chant.js";
import { whoHasTheKeys, type UiState } from "../ui/state.js";
import { setDayClock } from "../visuals/sky/daylight.js";
import type { Drawing } from "../visuals/visuals.js";
import { exposeDebugHandles } from "./debug.js";
import { startTransition, stepTransition, type Mode, type Transition } from "./transition.js";

/** A stalled tab's first frame back counts as this long at most, so it doesn't make a huge step. */
const MAX_FRAME_TIME = 0.1;

export interface Game {
  /** null outside a session. */
  mode(): Mode | null;
  /** On a connection the server has welcomed. */
  join(joined: Joined): void;
  /** Sends any unsent settings, hangs up, stops drawing, forgets the level and any fight. */
  leave(): void;
  /** Once the server's result is in: fade back to the overworld. */
  leaveBattle(): void;
  interact(): void;
  challenge(): void;
  answerChallenge(accept: boolean): void;
  useItem(at: GridSpot): void;
  moveItem(from: Spot, to: Spot, turned: boolean): void;
  castSkill(skill: Skill): void;
  saveSkill(page: number, skill: Skill): void;
  saveCharacter(character: Character): void;
  cheat(cheat: Cheat): void;
  setDayClock(change: DayChange): void;
}

interface GameParts {
  drawing: Drawing;
  actions: Actions;
  ui: UiState;
  settings: Settings;
  battle: Battle;
  overworld: Overworld;
}

export function createGame({ drawing, actions, ui, settings, battle, overworld }: GameParts): Game {
  let mode: Mode | null = null;
  let net: Net | null = null;
  let stopSync = () => {};
  let transition: Transition | null = null;
  /** The fight being flashed into. */
  let encounter: ServerMsgOf<"encounter"> | null = null;
  /** Held while the player is still in the arena: applied when they leave it. */
  let result: ServerMsgOf<"battleResult"> | null = null;

  /**
   * The game only gets input during a session with no screen over it (not even the title, still clearing off the
   * world, nor the open bag), and the mouse only in the arena (captured at once there if Auto mouse lock is on).
   */
  const updateInput = () => actions.setLayers(whoHasTheKeys(ui, mode));
  ui.settingsScreen.subscribe(updateInput);
  ui.admin.subscribe(updateInput);
  ui.creation.subscribe(updateInput);
  ui.overworldPanel.subscribe(updateInput);
  ui.chant.subscribe(updateInput);
  ui.skillbookScreen.subscribe(updateInput);
  ui.battleBag.subscribe(updateInput);
  // The fight breaks a chant off: a stagger loses its words, a dodge keeps them; a hit that only hurts doesn't. It
  // breaks the bag off the same way, and a decided fight closes it.
  ui.battle.subscribe(() => {
    const { brokenOff, stunned, result } = ui.battle.get();
    if (brokenOff && ui.chant.get().open) ui.chant.set(stunned ? NO_CHANT : { open: false });
    if ((brokenOff || result !== "fighting") && ui.battleBag.get().open) ui.closeBattleBag();
  });
  let bagOpen = false;
  ui.overworldPanel.subscribe(() => {
    const wasOpen = bagOpen;
    bagOpen = ui.overworldPanel.get().open === "inventory";
    if (wasOpen && !bagOpen) closeBag();
  });
  ui.title.subscribe(updateInput);
  updateInput();

  const closeBag = () => {
    const gear = ui.overworld.get().gear;
    if (gear.cloth.items.length === 0) return;
    say(ui.notifications, { kind: "leftOnCloth", items: bagCounts(gear.cloth) });
    overworld.setGear({ ...gear, cloth: { ...gear.cloth, items: [] } });
    net?.send({ t: "closeBag" });
  };

  const setMode = (next: Mode | null) => {
    mode = next;
    // Panels are the overworld's: a fight, or leaving, closes them.
    if (next !== "overworld") ui.closeOverworldPanel();
    ui.closeBattleBag();
    ui.chant.set(NO_CHANT);
    ui.screen.set({ mode: next });
    drawing.show(next);
    updateInput();
  };

  const enterBattle = (msg: ServerMsgOf<"encounter">) => {
    if (!net) return;
    result = null;
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
      overworld.onBattleResult(result);
      ui.skills.set({ book: result.skillbook });
      say(ui.notifications, { kind: "battleResult", outcome: result });
      result = null;
    }
    setMode("overworld");
  };

  /** No character yet: the creation screen opens (it closes itself), and the server holds the level back. */
  const applyCharacter = (character: Character | null) => {
    ui.overworld.set({ character });
    if (!character) ui.creation.set({ open: true });
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
    else if (mode === "battle") battle.update(dt);
    drawing.frame(dt);
  };

  const cheat = (c: Cheat) => net?.send({ t: "cheat", cheat: c });

  return {
    mode: () => mode,
    cheat,
    setDayClock,
    leaveBattle() {
      if (mode !== "battle" || transition || !result) return;
      transition = startTransition("overworld");
    },
    interact() {
      if (mode === "overworld" && !transition) overworld.interact();
    },
    challenge() {
      if (mode === "overworld" && !transition) net?.send({ t: "challenge" });
    },
    answerChallenge(accept) {
      ui.challenge.set({ from: null });
      net?.send({ t: "answerChallenge", accept });
    },
    useItem(at) {
      if (mode === "overworld" && !transition) net?.send({ t: "useItem", at });
    },
    moveItem(from, to, turned) {
      if (mode === "battle" && !transition) battle.ctx.gearMoves.push({ from, to, turned });
      if (mode !== "overworld" || transition || !net) return;
      const moved = moveGear(ui.overworld.get().gear, from, to, turned);
      if (!moved) return;
      overworld.setGear(moved);
      net.send({ t: "moveItem", from, to, turned });
    },
    castSkill(skill) {
      if (mode === "battle" && !transition) battle.ctx.casts.push(skill);
    },
    saveSkill(page, skill) {
      if (mode === "battle") {
        if (!transition) battle.ctx.writes.push({ page, skill });
      } else net?.send({ t: "saveSkill", page, skill });
    },
    saveCharacter(character) {
      net?.send({ t: "character", character });
    },
    join(joined) {
      net = joined.net;
      restoreSettings(settings, joined.welcome.settings);
      stopSync = syncSettings(settings, net);
      net.onPing((ms) => ui.ping.set({ ms }));
      overworld.join(joined);
      applyCharacter(joined.welcome.character);
      ui.skills.set({ known: joined.welcome.knownWords, book: joined.welcome.skillbook });
      net.on("challengeNews", ({ news }) => {
        if (news.kind === "received") ui.challenge.set({ from: news.from });
        else if (news.kind === "expired" || news.kind === "cancelled") ui.challenge.set({ from: null });
        say(ui.notifications, { kind: "challenge", news });
      });
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
      net.on("joinRefused", ({ reason }) => say(ui.notifications, { kind: "joinRefused", reason }));
      net.on("character", (msg) => applyCharacter(msg.character));
      net.on("rested", (msg) => {
        overworld.setVitals(msg.vitals);
        say(ui.notifications, { kind: "rested" });
      });
      net.on("itemUsed", (msg) => {
        overworld.setVitals(msg.vitals);
        overworld.setGear(msg.gear);
        say(ui.notifications, { kind: "itemUsed", item: msg.item });
      });
      net.on("healed", (msg) => {
        overworld.setVitals(msg.vitals);
        say(ui.notifications, { kind: "healed" });
      });
      net.on("given", (msg) => {
        overworld.setGear(msg.gear);
        say(ui.notifications, { kind: "given", item: msg.item, count: msg.count, left: msg.left });
      });
      net.on("invulnerable", (msg) => ui.admin.set({ invulnerable: msg.on }));
      net.on("skillbook", (msg) => ui.skills.set({ book: msg.skillbook }));
      net.on("battleResult", (msg) => {
        result = msg;
        battle.onResult(msg.won);
      });
      setMode("overworld");
      lastFrameMs = performance.now();
      frameRequest = requestAnimationFrame(loop);
      exposeDebugHandles({
        battle, overworld, ui, settings, mode: () => mode,
        encounter: (enemy: EnemyId = "wild-boar") => cheat({ kind: "encounter", enemy }),
      });
    },
    leave() {
      if (!net) return;
      stopSync();
      stopSync = () => {};
      ui.ping.set({ ms: null });
      cancelAnimationFrame(frameRequest);
      net.close();
      net = null;
      if (mode === "battle") battle.end();
      transition = encounter = result = null;
      overworld.leave();
      ui.settingsScreen.set({ open: false });
      ui.admin.set({ open: false, invulnerable: false });
      ui.creation.set({ open: false });
      ui.challenge.set({ from: null });
      ui.notifications.clear();
      ui.screen.set({ fadeOpacity: 0 });
      setMode(null);
    },
  };
}

