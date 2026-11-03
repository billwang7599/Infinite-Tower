/**
 * Everything the game tells the UI: game code writes these stores and React reads them (nothing here imports React).
 * The UI writes the `keyStores` and the title's `pickedSocket` too, and the game watches them. `UiActions` is the
 * other direction.
 */
import {
  blankSkillbook, NO_PILE, type Carried, type Character, type ChatLine, type ClientMsg, type CoreState,
  type Credentials, type DayChange, type DialogueOffer, type Faith, type GameServer, type Gear, type Look,
  type QuestView, type ShopView, type Skill, type Skillbook, type Spot, type Status, type UseSpot, type Word,
} from "@infinite-tower/shared";
import type { FightState } from "@infinite-tower/shared/fight";
import type { Layer } from "../core/actions.js";
import type { Mode } from "../game/transition.js";
import { Notifications } from "./notifications/state.js";
import { NO_CHANT, type ChantState } from "./skills/chant.js";
import { Store } from "./store.js";

export interface ScreenState {
  /** null until the game has started. */
  mode: Mode | null;
  fadeColor: string;
  fadeOpacity: number;
}

export interface TitleState {
  /**
   * checking (who's logged in?) -> menu (the login form, `signingIn` while it's sent, or Play). Play is connecting ->
   * loading -> entering (the title clears off the game) -> playing. A failed connection goes back to menu with
   * `error`; anything failing after that is `failed` and needs a reload. Return to title, or a lost connection, is
   * returning, then menu.
   */
  phase: "checking" | "menu" | "signingIn" | "connecting" | "loading" | "failed" | "entering" | "playing"
    | "returning";
  error: string | null;
  username: string | null;
  servers: GameServer[];
  pickedSocket: string | null;
}

/** A game is running and the title has cleared off it: only then do the HUDs show and anything take keys. */
export const inWorld = (mode: Mode | null, phase: TitleState["phase"]): boolean => mode !== null && phase === "playing";

export interface YouState {
  /** null until they've made one. */
  character: Character | null;
  /** null before `welcome`. */
  core: CoreState | null;
  faith: Faith;
  gear: Gear;
  using: UseSpot | null;
  wins: number;
}

export interface OverworldHudState {
  regionName: string;
  hpFraction: number;
  staminaFraction: number;
  byFire: boolean;
  interaction: Interaction | null;
  /** The camera's quarter turns right from north, unwrapped. */
  cameraTurns: number;
}

export type Interaction = "rest" | "joinFight" | "openPile" | "talk" | "look" | "bindPad";

export interface StatusIcon {
  status: Status;
  harmful: boolean;
  stacks: number;
  /** null: permanent. */
  secondsLeft: number | null;
  shareLeft: number;
}

export interface BattleHudState {
  hpFraction: number;
  staminaFraction: number;
  hp: number;
  hpMax: number;
  statuses: readonly StatusIcon[];
  enemyName: string;
  enemyHpFraction: number;
  enemyStatuses: readonly StatusIcon[];
  enemyAlive: boolean;
  result: FightState;
  duel: boolean;
  spar: boolean;
  /** Turns on a moment after `result` is decided (and off again soon, after a win that keeps the arena open). */
  showResult: boolean;
  afterFight: boolean;
  arenaSecondsLeft: number;
  dropInView: boolean;
  stunned: boolean;
  skillbookInHand: boolean;
  brokenOff: boolean;
  writingPage: number | null;
  carried: Carried;
  using: UseSpot | null;
  core: CoreState | null;
}

export interface SkillsState {
  known: readonly Word[];
  book: Skillbook;
}

export interface SettingsScreenState {
  open: boolean;
}

/** `invulnerable` is the server's say. */
export interface AdminState {
  open: boolean;
  invulnerable: boolean;
}

export interface PingState {
  /** null until a session's first pong. */
  ms: number | null;
}

export const CHAT_LOG_LINES = 100;

export interface ChatState {
  open: boolean;
  focused: boolean;
  lines: readonly ChatLine[];
}

export interface DialogueState {
  open: boolean;
  name: string;
  look: Look | null;
  lines: readonly string[];
  line: number;
  offer: DialogueOffer | null;
}

export interface QuestbookState {
  open: boolean;
  quests: readonly QuestView[];
}

/** The overworld's side panels; one is open at a time. Neither pauses the world. */
export type OverworldPanel = "character" | "inventory";

export interface OverworldPanelState {
  open: OverworldPanel | null;
  widthPx: number;
}

/** The game opens it when `welcome` has no character; it closes itself once one is made. There's no leaving it. */
export interface CreationState {
  open: boolean;
}

export type SignInKind = "login" | "register";

export type UiRequest = Extract<ClientMsg, {
  t: "buy" | "sell" | "exchange" | "carve" | "uncarve" | "challenge" | "statPoint" | "chat" | "character" | "cheat";
}>;

export interface GameRequests {
  request(msg: UiRequest): void;
  interact(): void;
  leaveBattle(sure?: boolean): void;
  answerChallenge(accept: boolean): void;
  useItem(at: UseSpot): void;
  moveItem(from: Spot, to: Spot, turned: boolean): void;
  castSkill(skill: Skill): void;
  saveSkill(page: number, skill: Skill): void;
  takeOffer(offer: DialogueOffer): void;
  setDayClock(change: DayChange): void;
}

export interface TitleActions {
  signIn(kind: SignInKind, credentials: Credentials): void;
  logOut(): void;
  play(): void;
  returnToTitle(): void;
}

export type UiActions = TitleActions & GameRequests;

export class UiState {
  readonly title = new Store<TitleState>({
    phase: "checking", error: null, username: null, servers: [], pickedSocket: null,
  });
  readonly screen = new Store<ScreenState>({ mode: null, fadeColor: "#000", fadeOpacity: 0 });
  /** The notices in the corner and the banner in the centre; game code reaches them through `say`. */
  readonly notifications = new Notifications();
  readonly settingsScreen = new Store<SettingsScreenState>({ open: false });
  readonly admin = new Store<AdminState>({ open: false, invulnerable: false });
  readonly ping = new Store<PingState>({ ms: null });
  readonly creation = new Store<CreationState>({ open: false });
  readonly overworldPanel = new Store<OverworldPanelState>({ open: null, widthPx: 0 });
  readonly you = new Store<YouState>({
    character: null, core: null, faith: {}, using: null, wins: 0,
    gear: {
      bag: { cols: 0, rows: 0, items: [] }, cloth: { cols: 0, rows: 0, items: [] }, pile: NO_PILE,
      equipment: { rightHand: null, leftHand: null, head: null, body: null, legs: null, boots: null },
    },
  });
  readonly overworld = new Store<OverworldHudState>({
    regionName: "…", hpFraction: 1, staminaFraction: 1, byFire: false, interaction: null, cameraTurns: 0,
  });
  readonly battle = new Store<BattleHudState>({
    hpFraction: 1, staminaFraction: 1, hp: 0, hpMax: 0, statuses: [], enemyName: "", enemyHpFraction: 1,
    enemyStatuses: [], enemyAlive: false, result: "fighting", duel: false, spar: false, showResult: false,
    afterFight: false, arenaSecondsLeft: 0, dropInView: false,
    stunned: false, skillbookInHand: false, brokenOff: false, writingPage: null, using: null, core: null,
    carried: {
      bag: { cols: 0, rows: 0, items: [] },
      equipment: { rightHand: null, leftHand: null, head: null, body: null, legs: null, boots: null },
    },
  });
  readonly skills = new Store<SkillsState>({ known: [], book: blankSkillbook() });
  readonly chant = new Store<ChantState>(NO_CHANT);
  readonly skillbookScreen = new Store<{ open: boolean }>({ open: false });
  readonly battleBag = new Store<{ open: boolean }>({ open: false });
  readonly leaveArena = new Store<{ asking: boolean }>({ asking: false });
  readonly challenge = new Store<{ from: string | null }>({ from: null });
  readonly chat = new Store<ChatState>({ open: false, focused: false, lines: [] });
  readonly dialogue = new Store<DialogueState>({
    open: false, name: "", look: null, lines: [], line: 0, offer: null,
  });
  readonly questbook = new Store<QuestbookState>({ open: false, quests: [] });
  readonly shop = new Store<{ view: ShopView | null }>({ view: null });

  /** What `whoHasTheKeys` reads: one left out here leaves the keys stuck when it changes. */
  readonly keyStores: readonly Store<object>[] = [
    this.title, this.settingsScreen, this.admin, this.creation, this.overworldPanel, this.chant, this.skillbookScreen,
    this.battleBag, this.leaveArena, this.chat, this.dialogue, this.questbook,
  ];

  readonly resetSession = (): void => {
    for (const store of [
      this.screen, this.ping, this.settingsScreen, this.admin, this.creation, this.challenge, this.chat,
      this.questbook, this.shop,
    ] as const) store.reset();
    this.notifications.clear();
  };

  readonly openSettings = (): void => this.settingsScreen.set({ open: true });
  readonly closeSettings = (): void => this.settingsScreen.set({ open: false });
  readonly closeCreation = (): void => this.creation.set({ open: false });
  readonly toggleOverworldPanel = (panel: OverworldPanel): void => {
    this.overworldPanel.set({ open: this.overworldPanel.get().open === panel ? null : panel });
    this.skillbookScreen.set({ open: false });
  };
  readonly toggleBattleBag = (): void => {
    this.battleBag.set({ open: !this.battleBag.get().open });
    this.skillbookScreen.set({ open: false });
  };
  readonly closeBattleBag = (): void => {
    this.battleBag.set({ open: false });
    this.skillbookScreen.set({ open: false });
  };
  readonly hearChat = (lines: readonly ChatLine[]): void =>
    this.chat.set({ lines: [...this.chat.get().lines, ...lines].slice(-CHAT_LOG_LINES) });
  readonly openDialogue = (
    name: string, look: Look | null, lines: readonly string[], offer: DialogueOffer | null = null,
  ): void => this.dialogue.set({ open: true, name, look, lines, line: 0, offer });
  readonly nextLine = (): DialogueOffer | null => {
    const { line, lines, offer } = this.dialogue.get();
    if (line + 1 < lines.length) {
      this.dialogue.set({ line: line + 1 });
      return null;
    }
    this.closeDialogue();
    return offer;
  };
  readonly closeDialogue = (): void => this.dialogue.set({ open: false });
  readonly toggleQuestbook = (): void => this.questbook.set({ open: !this.questbook.get().open });
  readonly closeQuestbook = (): void => this.questbook.set({ open: false });
  readonly closeOverworldPanel = (): void => {
    this.overworldPanel.set({ open: null });
    this.skillbookScreen.set({ open: false });
  };
}

/**
 * You stand still while the bag is open (in a fight the fight holds you still, and a dodge still goes); the character
 * panel only shows things, so you walk with it open.
 */
export function whoHasTheKeys(ui: UiState, mode: Mode | null): Layer[] {
  if (mode === null || !inWorld(mode, ui.title.get().phase)) return ["title"];
  const layers: Layer[] = [mode];
  if (mode === "overworld" && ui.overworldPanel.get().open === "inventory") {
    layers.push("bag");
    if (ui.skillbookScreen.get().open) layers.push("skillbook");
  }
  if (mode === "battle" && ui.chant.get().open) layers.push("chant");
  if (mode === "battle" && ui.battleBag.get().open) {
    layers.push("battleBag");
    if (ui.skillbookScreen.get().open) layers.push("skillbook");
  }
  if (mode === "battle" && ui.leaveArena.get().asking) layers.push("leaveArena");
  if (ui.dialogue.get().open) layers.push("dialogue");
  if (ui.questbook.get().open) layers.push("questbook");
  if (ui.chat.get().focused) layers.push("chat");
  if (ui.admin.get().open) layers.push("admin");
  if (ui.settingsScreen.get().open) layers.push("settings");
  if (ui.creation.get().open) layers.push("creation");
  return layers;
}
