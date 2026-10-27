/**
 * Everything the game tells the HTML UI. Game code writes these stores and React reads them; nothing here
 * imports React, so game code never touches it. The exceptions are `settingsScreen`, `creation` and `overworldPanel`:
 * the UI opens or closes them too, and the game watches them, to stop taking input while they have the keys.
 * The notices and the centre banner are their own piece (notifications/). `UiActions` is the other direction.
 */
import type { Bag, Cell, Character, Credentials, Stats } from "@infinite-tower/shared";
import type { FightState } from "@infinite-tower/shared/fight";
import type { Mode } from "../game/transition.js";
import { Notifications } from "./notifications/state.js";
import { Store } from "./store.js";

export interface ScreenState {
  /** null until the game has started. */
  mode: Mode | null;
  fadeColor: string;
  fadeOpacity: number;
}

export interface TitleState {
  /**
   * checking (asking the server who's logged in) -> menu. In the menu, logged out shows the login form
   * (submitting it is `signingIn`, then back to menu, logged in); logged in shows Play. Play is
   * connecting -> loading -> entering (the game has joined; the title clears off it) -> playing (the title is
   * gone, and the game gets input: game.ts). A failed connection goes back to menu with `error` (Play becomes
   * Retry); anything failing after that is `failed` and needs a reload. Return to title, or losing the connection
   * while playing, is returning (the game stops under the white), then menu. How each looks:
   * ui/screens/title/sequence.ts.
   */
  phase: "checking" | "menu" | "signingIn" | "connecting" | "loading" | "failed" | "entering" | "playing"
    | "returning";
  error: string | null;
  /** The logged-in account's username, or null. */
  username: string | null;
}

/**
 * The player is in the world: a game is running and the title has cleared off it. Only then do the HUDs show and
 * the game, and the screens over it, take keys (App.tsx, game.ts).
 */
export const inWorld = (mode: Mode | null, phase: TitleState["phase"]): boolean => mode !== null && phase === "playing";

export interface OverworldHudState {
  levelName: string;
  wins: number;
  hpFraction: number;
  staminaFraction: number;
  /** The player's stats, for the character panel (null before `welcome`). */
  stats: Stats | null;
  /** Their name and look (null until they've made a character). */
  character: Character | null;
  /** Standing by a campfire: the Rest button shows. */
  nearCampfire: boolean;
  bag: Bag;
}

/** A word over the fight for a moment of it: you parried the enemy, or you're staggered (parried, guard broken). */
export type BattleCue = "none" | "parried" | "staggered";

export interface BattleHudState {
  hpFraction: number;
  staminaFraction: number;
  /** The damage multiplier the chain's momentum gives the next swing: 1 with no chain going. */
  comboMultiplier: number;
  cue: BattleCue;
  enemyName: string;
  enemyHpFraction: number;
  enemyAlive: boolean;
  result: FightState;
  /** Turns on a moment after `result` is decided. */
  showResult: boolean;
}

export interface SettingsScreenState {
  open: boolean;
}

export interface PingState {
  /** Null until a session's first pong. */
  ms: number | null;
}

/** The overworld's side panels; one is open at a time. Neither pauses the world. */
export type OverworldPanel = "character" | "inventory";

export interface OverworldPanelState {
  open: OverworldPanel | null;
}

/**
 * The open bag has the keys on the overworld: you stand still while it's open (it's worked with the mouse, and has
 * a few keys of its own: settings/bindings.ts, `bag`). The character panel only shows things, so you walk with it
 * open.
 */
export const bagHasTheKeys = (mode: Mode | null, panel: OverworldPanel | null): boolean =>
  mode === "overworld" && panel === "inventory";

/**
 * Making a character, on a first visit (screens/creation/). The game opens it when `welcome` has no character; it
 * closes itself once the character is made and its white has cleared off the world. There's no leaving it.
 */
export interface CreationState {
  open: boolean;
}

export type SignInKind = "login" | "register";

export interface UiActions {
  /** Logs in (or makes the account), then plays. */
  signIn(kind: SignInKind, credentials: Credentials): void;
  logOut(): void;
  play(): void;
  /** Rest at the campfire you're standing by. */
  rest(): void;
  /** Use one of the item in that bag cell (eat the meat); the server answers with what it did. */
  useItem(at: Cell): void;
  /**
   * Move the stack whose top-left is `from` so its top-left is at `to`, turned or not. The bag shows it moved at
   * once; the server answers with the bag as it has it.
   */
  moveItem(from: Cell, to: Cell, turned: boolean): void;
  /** Send the new character to the server, which answers with it as saved (`OverworldHudState.character`). */
  saveCharacter(character: Character): void;
  /** Leave the world: disconnects from the server. */
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
    bag: { cols: 0, rows: 0, items: [] },
  });
  readonly battle = new Store<BattleHudState>({
    hpFraction: 1, staminaFraction: 1, comboMultiplier: 1, cue: "none", enemyName: "", enemyHpFraction: 1,
    enemyAlive: false,
    result: "fighting", showResult: false,
  });

  readonly openSettings = (): void => this.settingsScreen.set({ open: true });
  readonly closeSettings = (): void => this.settingsScreen.set({ open: false });
  readonly closeCreation = (): void => this.creation.set({ open: false });
  /** Open that panel, or close it if it's the one open. */
  readonly toggleOverworldPanel = (panel: OverworldPanel): void =>
    this.overworldPanel.set({ open: this.overworldPanel.get().open === panel ? null : panel });
  readonly closeOverworldPanel = (): void => this.overworldPanel.set({ open: null });
}
