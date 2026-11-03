/**
 * Sessions and switching between the two modes (modes/overworld/, modes/battle/). A session (join -> leave) is one
 * connection; this keeps the settings in sync, and runs the transitions: an encounter flashes into battle, leaving a
 * decided fight fades back to the overworld, where the server's result is applied and told.
 */
import {
  bagCounts, coreStats, LocalPlayer, moveGear, NO_PILE, Player, useSteps, type Character, type Cheat, type CoinId,
  type DayChange, type DialogueOffer, type EnemyId, type InscriptionId, type ItemId, type ServerMsgOf, type ShownStat,
  type Skill, type Spot, type UseSpot, type WeaponId,
} from "@infinite-tower/shared";
import type { Audio } from "../audio/audio.js";
import { bagSound } from "../audio/sounds.js";
import type { Battle } from "../modes/battle/battle.js";
import type { Actions } from "../core/actions.js";
import type { Overworld } from "../modes/overworld/overworld.js";
import type { Joined, Net } from "../net/net.js";
import { restoreSettings, syncSettings, type Settings } from "../settings/settings.js";
import { say } from "../ui/notifications/say.js";
import { NO_CHANT } from "../ui/skills/chant.js";
import { whoHasTheKeys, type UiState } from "../ui/state.js";
import { NPC_LOOKS } from "../visuals/npcs/index.js";
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
  leave(): void;
  leaveBattle(sure?: boolean): void;
  interact(): void;
  challenge(): void;
  answerChallenge(accept: boolean): void;
  useItem(at: UseSpot): void;
  moveItem(from: Spot, to: Spot, turned: boolean): void;
  buy(item: ItemId): void;
  sell(at: UseSpot, count: number): void;
  exchange(from: CoinId, to: CoinId): void;
  carve(at: UseSpot): void;
  uncarve(inscription: InscriptionId): void;
  tooWeak(item: WeaponId): void;
  castSkill(skill: Skill): void;
  saveSkill(page: number, skill: Skill): void;
  sendChat(text: string): void;
  takeOffer(offer: DialogueOffer): void;
  saveCharacter(character: Character): void;
  cheat(cheat: Cheat): void;
  setDayClock(change: DayChange): void;
  statPoint(stat: ShownStat, add: boolean): void;
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
  /** Held while the player is still in the arena: applied when they leave it. */
  let result: ServerMsgOf<"battleResult"> | null = null;
  /** A resync can replay a use onto a later step; two can't end within the second's use time, so it's told once. */
  let lastUsedStep = -Infinity;

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
  ui.leaveArena.subscribe(updateInput);
  ui.chat.subscribe(updateInput);
  ui.dialogue.subscribe(updateInput);
  ui.questbook.subscribe(updateInput);
  // The fight breaks a chant off: a stagger loses its words, a dodge keeps them; a hit that only hurts doesn't. It
  // breaks the bag off the same way, and the fight's result closes it (after a win it opens again on the server's
  // gear, for the drops).
  let shownResult = ui.battle.get().result;
  ui.battle.subscribe(() => {
    const { brokenOff, stunned, result } = ui.battle.get();
    const decided = result !== shownResult && result !== "fighting";
    shownResult = result;
    if (brokenOff && ui.chant.get().open) ui.chant.set(stunned ? NO_CHANT : { open: false });
    if ((brokenOff || decided) && ui.battleBag.get().open) ui.closeBattleBag();
  });
  let bagOpen = false;
  ui.overworldPanel.subscribe(() => {
    const wasOpen = bagOpen;
    bagOpen = ui.overworldPanel.get().open === "inventory";
    if (wasOpen && !bagOpen) closeBag();
  });
  let battleBagOpen = false;
  ui.battleBag.subscribe(() => {
    const wasOpen = battleBagOpen;
    battleBagOpen = ui.battleBag.get().open;
    if (wasOpen && !battleBagOpen) closeBag();
  });
  ui.title.subscribe(updateInput);
  updateInput();

  const closeBag = () => {
    const { gear, using } = ui.overworld.get(), shopOpen = ui.shop.get().view !== null;
    if (gear.cloth.items.length === 0 && gear.pile.cols === 0 && !using && !shopOpen) return;
    ui.shop.set({ view: null });
    if (gear.cloth.items.length > 0) say(ui.notifications, { kind: "leftOnCloth", items: bagCounts(gear.cloth) });
    overworld.setGear({ ...gear, cloth: { ...gear.cloth, items: [] }, pile: NO_PILE });
    net?.send({ t: "closeBag" });
  };

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
      overworld.onBattleResult(result);
      ui.skills.set({ book: result.skillbook });
      say(ui.notifications, { kind: "battleResult", outcome: result });
      result = null;
    }
    setMode("overworld");
  };

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

  const cheat = (c: Cheat) => net?.send({ t: "cheat", cheat: c });
  const takeOffer = (offer: DialogueOffer) => {
    ui.closeDialogue();
    if (offer.kind === "shop") net?.send({ t: "openShop" });
    else if (offer.kind === "train") net?.send({ t: "train" });
    else if (offer.kind === "quest") net?.send({ t: "acceptQuest", quest: offer.quest });
    else net?.send({ t: "deliver", quest: offer.quest });
  };
  const afterFight = () => mode === "battle" && !transition && battle.ctx.afterFightMs !== null;

  return {
    mode: () => mode,
    cheat,
    setDayClock,
    takeOffer,
    leaveBattle(sure = false) {
      if (mode !== "battle" || transition || !result) return;
      if (!sure && battle.ctx.drops.length > 0) {
        ui.leaveArena.set({ asking: true });
        return;
      }
      transition = startTransition("overworld");
    },
    interact() {
      if (transition) return;
      if (ui.dialogue.get().open) {
        const offer = ui.nextLine();
        if (offer) takeOffer(offer);
      } else if (mode === "battle") {
        if (!ui.battle.get().dropInView) return;
        net?.send({ t: "openPile" });
        if (!battleBagOpen) ui.toggleBattleBag();
      } else if (mode === "overworld" && overworld.interact() === "openPile" && !bagOpen) {
        ui.toggleOverworldPanel("inventory");
      }
    },
    challenge() {
      if (mode === "overworld" && !transition) net?.send({ t: "challenge" });
    },
    answerChallenge(accept) {
      ui.challenge.set({ from: null });
      net?.send({ t: "answerChallenge", accept });
    },
    useItem(at) {
      if (transition) return;
      if (mode === "battle" && !afterFight()) battle.ctx.uses.push(at);
      else if (mode === "overworld" || afterFight()) net?.send({ t: "useItem", at });
    },
    moveItem(from, to, turned) {
      if (!transition) audio.play(bagSound(from, to));
      if (mode === "battle" && !transition && !afterFight()) battle.ctx.gearMoves.push({ from, to, turned });
      if ((mode !== "overworld" && !afterFight()) || transition || !net) return;
      const { gear, core } = ui.overworld.get();
      const moved = core && moveGear(gear, from, to, turned, coreStats(core).strength);
      if (!moved) return;
      overworld.setGear(moved);
      net.send({ t: "moveItem", from, to, turned });
    },
    buy(item) {
      if (mode === "overworld" && !transition) net?.send({ t: "buy", item });
    },
    sell(at, count) {
      if (mode === "overworld" && !transition) net?.send({ t: "sell", at, count });
    },
    exchange(from, to) {
      if (mode === "overworld" && !transition) net?.send({ t: "exchange", from, to });
    },
    carve(at) {
      if (mode === "overworld" && !transition) net?.send({ t: "carve", at });
    },
    uncarve(inscription) {
      if (mode === "overworld" && !transition) net?.send({ t: "uncarve", inscription });
    },
    tooWeak(item) {
      say(ui.notifications, { kind: "tooWeak", item });
    },
    castSkill(skill) {
      if (mode === "battle" && !transition) battle.ctx.casts.push(skill);
    },
    saveSkill(page, skill) {
      if (mode === "battle" && !afterFight()) {
        if (!transition) battle.ctx.writes.push({ page, skill });
      } else net?.send({ t: "saveSkill", page, skill });
    },
    sendChat(text) {
      net?.send({ t: "chat", text });
    },
    statPoint(stat, add) {
      net?.send({ t: "statPoint", stat, add });
    },
    saveCharacter(character) {
      net?.send({ t: "character", character });
    },
    join(joined) {
      audio.unlock();
      net = joined.net;
      restoreSettings(settings, joined.welcome.settings);
      stopSync = syncSettings(settings, net);
      net.onPing((ms) => ui.ping.set({ ms }));
      overworld.join(joined);
      applyCharacter(joined.welcome.character);
      ui.skills.set({ known: joined.welcome.knownWords, book: joined.welcome.skillbook });
      ui.chat.set({ open: false, focused: false, lines: joined.welcome.chat });
      ui.questbook.set({ open: false, quests: joined.welcome.questbook });
      ui.overworld.set({ faith: joined.welcome.faith });
      net.on("questbook", ({ quests, news }) => {
        ui.questbook.set({ quests });
        for (const told of news) say(ui.notifications, { kind: "quest", news: told });
      });
      net.on("chat", ({ line }) => ui.hearChat([line]));
      net.on("chatRefused", ({ reason }) => say(ui.notifications, { kind: "chatRefused", reason }));
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
      net.on("dialogue", ({ npc, trace, lines, offer }) => {
        const { name, look } = NPC_LOOKS[npc];
        if (trace) ui.openDialogue(`${name}'s bedroll`, null, lines);
        else ui.openDialogue(name, look, lines, offer);
      });
      net.on("shop", ({ shop }) => {
        ui.shop.set({ view: shop });
        if (shop && ui.overworldPanel.get().open !== "inventory") ui.toggleOverworldPanel("inventory");
      });
      net.on("trade", (msg) => {
        overworld.setGear(msg.gear);
        ui.shop.set({ view: msg.shop });
        say(ui.notifications, { kind: "trade", news: msg.news });
      });
      net.on("rested", (msg) => {
        overworld.setVitals(msg.vitals);
        say(ui.notifications, { kind: "rested" });
      });
      net.on("padBound", ({ already }) => say(ui.notifications, { kind: "padBound", already }));
      net.on("using", ({ at }) => ui.overworld.set({ using: at }));
      net.on("itemUsed", (msg) => {
        ui.overworld.set({ using: null });
        if (result) result = { ...result, vitals: msg.vitals, gear: msg.gear };
        overworld.setVitals(msg.vitals);
        overworld.setGear(msg.gear);
        say(ui.notifications, { kind: "itemUsed", item: msg.item });
      });
      net.on("core", (msg) => {
        if (result) result = { ...result, core: msg.core, vitals: msg.vitals };
        overworld.setCore(msg.core);
        overworld.setVitals(msg.vitals);
        if (msg.brokeThrough) say(ui.notifications, { kind: "breakthrough", core: msg.core });
      });
      net.on("faith", ({ faith, gained, blessed }) => {
        ui.overworld.set({ faith });
        say(ui.notifications, { kind: "faith", gained, blessed });
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
      net.on("noQuest", () => say(ui.notifications, { kind: "noQuest" }));
      net.on("skillbook", (msg) => ui.skills.set({ book: msg.skillbook }));
      net.on("battleResult", (msg) => {
        result = msg;
        overworld.setGear(msg.gear);
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
        encounter: (enemy: EnemyId = "wild-boar") => cheat({ kind: "encounter", enemy }),
      });
    },
    leave() {
      if (!net) return;
      stopSync();
      stopSync = () => {};
      ui.ping.set({ ms: null });
      cancelAnimationFrame(frameRequest);
      audio.frame(null);
      net.close();
      net = null;
      if (mode === "battle") battle.end();
      transition = encounter = result = null;
      overworld.leave();
      ui.settingsScreen.set({ open: false });
      ui.admin.set({ open: false, invulnerable: false });
      ui.creation.set({ open: false });
      ui.challenge.set({ from: null });
      ui.chat.set({ open: false, focused: false, lines: [] });
      ui.questbook.set({ open: false, quests: [] });
      ui.shop.set({ view: null });
      ui.notifications.clear();
      ui.screen.set({ fadeOpacity: 0 });
      setMode(null);
    },
  };
}

