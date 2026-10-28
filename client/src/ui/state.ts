/**
 * Everything the game tells the UI: game code writes these stores and React reads them (nothing here imports React).
 * The UI writes `settingsScreen`, `creation`, `overworldPanel`, `chant`, `battleBag` and `skillbookScreen` too, and
 * the game watches them. `UiActions` is the other direction.
 */
import {
  blankSkillbook, type Carried, type Character, type Credentials, type Gear, type GridSpot, type Skill, type Skillbook,
  type Spot, type Stats, type Word,
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
}

/** A game is running and the title has cleared off it: only then do the HUDs show and anything take keys. */
export const inWorld = (mode: Mode | null, phase: TitleState["phase"]): boolean => mode !== null && phase === "playing";

export interface OverworldHudState {
  levelName: string;
  wins: number;
  hpFraction: number;
  staminaFraction: number;
  /** null before `welcome`. */
  stats: Stats | null;
  /** null until they've made one. */
  character: Character | null;
  /** The Rest button shows. */
  nearCampfire: boolean;
  gear: Gear;
}

/** A word over the fight for a moment: you parried the enemy, or you're staggered. */
export type BattleCue = "none" | "parried" | "staggered";

export interface BattleHudState {
  hpFraction: number;
  staminaFraction: number;
  comboMultiplier: number;
  cue: BattleCue;
  enemyName: string;
  enemyHpFraction: number;
  enemyAlive: boolean;
  result: FightState;
  /** Turns on a moment after `result` is decided. */
  showResult: boolean;
  stunned: boolean;
  skillbookInHand: boolean;
  brokenOff: boolean;
  writingPage: number | null;
  carried: Carried;
}

export interface SkillsState {
  known: readonly Word[];
  book: Skillbook;
}

export interface SettingsScreenState {
  open: boolean;
}

export interface PingState {
  /** null until a session's first pong. */
  ms: number | null;
}

/** The overworld's side panels; one is open at a time. Neither pauses the world. */
export type OverworldPanel = "character" | "inventory";

export interface OverworldPanelState {
  open: OverworldPanel | null;
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
  if (ui.settingsScreen.get().open) layers.push("settings");
  if (ui.creation.get().open) layers.push("creation");
  return layers;
}

/** The game opens it when `welcome` has no character; it closes itself once one is made. There's no leaving it. */
export interface CreationState {
  open: boolean;
}

export type SignInKind = "login" | "register";

export interface UiActions {
  /** Logs in (or makes the account), then plays. */
  signIn(kind: SignInKind, credentials: Credentials): void;
  logOut(): void;
  play(): void;
  rest(): void;
  useItem(at: GridSpot): void;
  moveItem(from: Spot, to: Spot, turned: boolean): void;
  castSkill(skill: Skill): void;
  saveSkill(page: number, skill: Skill): void;
  saveCharacter(character: Character): void;
  returnToTitle(): void;
}

export class UiState {
  readonly title = new Store<TitleState>({ phase: "checking", error: null, username: null });
  readonly screen = new Store<ScreenState>({ mode: null, fadeColor: "#000", fadeOpacity: 0 });
  /** The notices in the corner and the banner in the centre; game code reaches them through `say`. */
  readonly notifications = new Notifications();
  readonly settingsScreen = new Store<SettingsScreenState>({ open: false });
  readonly ping = new Store<PingState>({ ms: null });
  readonly creation = new Store<CreationState>({ open: false });
  readonly overworldPanel = new Store<OverworldPanelState>({ open: null });
  readonly overworld = new Store<OverworldHudState>({
    levelName: "…", wins: 0, hpFraction: 1, staminaFraction: 1, stats: null, character: null, nearCampfire: false,
    gear: {
      bag: { cols: 0, rows: 0, items: [] }, cloth: { cols: 0, rows: 0, items: [] },
      equipment: { rightHand: null, leftHand: null, head: null, body: null, legs: null, boots: null },
    },
  });
  readonly battle = new Store<BattleHudState>({
    hpFraction: 1, staminaFraction: 1, comboMultiplier: 1, cue: "none", enemyName: "", enemyHpFraction: 1,
    enemyAlive: false,
    result: "fighting", showResult: false, stunned: false, skillbookInHand: false, brokenOff: false,
    writingPage: null,
    carried: {
      bag: { cols: 0, rows: 0, items: [] },
      equipment: { rightHand: null, leftHand: null, head: null, body: null, legs: null, boots: null },
    },
  });
  readonly skills = new Store<SkillsState>({ known: [], book: blankSkillbook() });
  readonly chant = new Store<ChantState>(NO_CHANT);
  readonly skillbookScreen = new Store<{ open: boolean }>({ open: false });
  readonly battleBag = new Store<{ open: boolean }>({ open: false });

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
  readonly closeOverworldPanel = (): void => {
    this.overworldPanel.set({ open: null });
    this.skillbookScreen.set({ open: false });
  };
}
